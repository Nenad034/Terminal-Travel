import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientContract } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { AgencyStaticConfigService } from './agency-static-config';
import { buildContentSnapshot, determineContractType } from './contract-content-builder';
import type { ContractDocumentGeneratorAdapter } from '../adapters/contract-document-generator-adapter.interface';
import { CONTRACT_DOCUMENT_GENERATOR_ADAPTER } from '../adapters/contract-document-generator.token';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';

// M20 spec §3 — DRAFT→GENERATED je nivo "Autonomno" (deterministično sastavljanje iz postojećih
// podataka, princip #4 Master dokumenta); ACCEPT/VOID su uvek ljudska ili sistemski-deterministička
// radnja, nikad AI procena.
@Injectable()
export class ClientContractsService {
  private readonly logger = new Logger(ClientContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly agencyConfig: AgencyStaticConfigService,
    @Inject(CONTRACT_DOCUMENT_GENERATOR_ADAPTER) private readonly gateway: ContractDocumentGeneratorAdapter,
    private readonly permissions: PermissionsService,
  ) {}

  // §6 dopuna (avgust 2026, priprema za M8) — ClientContract nema sopstveni
  // client_account_id, ide preko booking.client_account_id. Gost (GOST rola dobija
  // M20/client-contract/VIEW, M5 spec §10 tabela) sme da vidi isključivo ugovore
  // sopstvenih rezervacija — bez ove provere bi mogao da pročita TUĐ ugovor (uklj.
  // ime/adresu/cenu nalogodavca) prostim nagađanjem ID-a.
  // Dopuna 31.8.2026 (M1 §3.9a konvencija) — STAFF bez `M20/client-contract/VIEW_ALL` sužava
  // se analogno, na ugovore rezervacija u sopstvenom vlasništvu/zaduženju (M5 §6.6).
  async findMany(filter: { bookingId?: string; status?: ClientContract['status'] }, actorUserId?: string) {
    const ownAccountId = await this.ownAccountIdIfGuest(actorUserId);
    if (ownAccountId === null) return []; // gost bez sopstvenog naloga (još) — nema šta da vidi

    let scopedToOwnBooking = false;
    if (ownAccountId === undefined && actorUserId) {
      const hasViewAll = await this.permissions.hasPermission(actorUserId, 'M20', 'client-contract', 'VIEW_ALL');
      scopedToOwnBooking = !hasViewAll;
    }

    return this.prisma.clientContract.findMany({
      where: {
        bookingId: filter.bookingId,
        status: filter.status,
        booking:
          ownAccountId !== undefined
            ? { clientAccountId: ownAccountId }
            : scopedToOwnBooking
              ? { OR: [{ ownerId: actorUserId }, { assignedToId: actorUserId }] }
              : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actorUserId?: string): Promise<ClientContract> {
    const contract = await this.prisma.clientContract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException(`ClientContract ${id} nije pronađen.`);

    const ownAccountId = await this.ownAccountIdIfGuest(actorUserId);
    if (ownAccountId !== undefined) {
      // Odvojen upit (ne include) — sprečava da booking (sa internim poljima poput
      // supplier_reference) slučajno ispadne u odgovor gostu.
      const booking = await this.prisma.booking.findUnique({ where: { id: contract.bookingId } });
      if (booking?.clientAccountId !== ownAccountId) throw new NotFoundException(`ClientContract ${id} nije pronađen.`);
    } else if (actorUserId) {
      const hasViewAll = await this.permissions.hasPermission(actorUserId, 'M20', 'client-contract', 'VIEW_ALL');
      if (!hasViewAll) {
        const booking = await this.prisma.booking.findUnique({ where: { id: contract.bookingId } });
        if (booking?.ownerId !== actorUserId && booking?.assignedToId !== actorUserId) {
          throw new NotFoundException(`ClientContract ${id} nije pronađen.`);
        }
      }
    }
    return contract;
  }

  /** `undefined` = pozivalac nije Gost (nema ownership restrikciju); `string | null` = Gost, sopstveni nalog (ili null ako ga još nema). */
  private async ownAccountIdIfGuest(actorUserId: string | undefined): Promise<string | null | undefined> {
    if (!actorUserId) return undefined;
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);
    return identity.accountType === 'GUEST' ? identity.ownProfileId : undefined;
  }

  // §3.1 — poziva se na M5 booking.confirmed. Idempotentno: ako AKTIVAN (ne-VOIDED) ugovor za
  // ovaj booking već postoji, vraća ga bez ponovnog generisanja.
  async generateForBooking(bookingId: string): Promise<ClientContract | null> {
    const existing = await this.prisma.clientContract.findFirst({ where: { bookingId, status: { not: 'VOIDED' } } });
    if (existing) return existing;

    return this.generate(bookingId, null);
  }

  // §3.4 — poziva se na M5 booking.modified. Poništava aktivan ugovor (sistemski) i generiše
  // novu verziju koja UVEK zahteva ponovno prihvatanje, čak i ako je prethodna bila ACCEPTED.
  async voidAndRegenerateForModification(bookingId: string): Promise<ClientContract | null> {
    const current = await this.prisma.clientContract.findFirst({ where: { bookingId, status: { not: 'VOIDED' } } });
    if (!current) return null; // nema aktivnog ugovora (npr. samo-INSURANCE rezervacija) — ništa za revidovati

    const voided = await this.prisma.clientContract.update({
      where: { id: current.id },
      data: { status: 'VOIDED', voidedBy: null },
    });
    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M20',
      action: 'client_contract.voided_for_modification',
      resourceType: 'ClientContract',
      resourceId: voided.id,
      afterState: voided,
    });

    return this.generate(bookingId, current.id);
  }

  private async generate(bookingId: string, supersedesContractId: string | null): Promise<ClientContract | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: {
          include: {
            product: { include: { translations: true } },
            rateLine: { include: { contractPeriod: { include: { cancellationRules: true } } } },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} nije pronađen.`);

    const contractType = determineContractType(booking as any);
    if (!contractType) {
      this.logger.warn(`Booking ${bookingId} nema podržan contract_type za automatsko generisanje (M20 spec §2.2/§8) — preskočeno.`);
      return null;
    }

    const [travelGuarantee, paymentSchedule] = await Promise.all([
      contractType === 'ORGANIZOVANO_PUTOVANJE'
        ? this.prisma.travelGuarantee.findFirst({ orderBy: { validTo: 'desc' } })
        : Promise.resolve(null),
      this.prisma.clientPaymentSchedule.findUnique({ where: { bookingId } }),
    ]);

    const contentSnapshot = buildContentSnapshot({
      booking: booking as any,
      contractType,
      travelGuarantee,
      paymentSchedule,
      agency: this.agencyConfig.get(),
    });

    const { documentUrl } = await this.gateway.generate({ contractType, contentSnapshot });

    const now = new Date();
    // §3.2 — samouslužni kanali (M8/M9/M7) su clickwrap pristanak dali PRE potvrde rezervacije
    // (Quote.contract_terms_accepted), preneto na Booking.contract_terms_accepted_at (M5 dopuna).
    // Prva generacija ugovora to automatski prevodi u ACCEPTED. Revizija (supersedesContractId
    // != null) UVEK ostaje GENERATED i traži ponovno prihvatanje (§3.4 tačka 3), bez obzira na to.
    const autoAccept = supersedesContractId === null && booking.contractTermsAcceptedAt !== null;

    const contract = await this.prisma.clientContract.create({
      data: {
        bookingId,
        contractType,
        status: autoAccept ? 'ACCEPTED' : 'GENERATED',
        documentUrl,
        generatedAt: now,
        acceptedAt: autoAccept ? booking.contractTermsAcceptedAt : null,
        acceptedMethod: autoAccept ? 'ELECTRONIC_CLICKWRAP' : null,
        supersedesContractId,
        contentSnapshot: contentSnapshot as any,
      },
    });

    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M20',
      action: supersedesContractId ? 'client_contract.regenerated' : 'client_contract.generated',
      resourceType: 'ClientContract',
      resourceId: contract.id,
      afterState: contract,
    });

    return contract;
  }

  // §3.2 druga alineja — ručno evidentiranje (interni panel/telefon), isključivo ljudska radnja,
  // dozvola M20/client-contract/ACCEPT (gost prihvata sam kroz M8 tok, §3.2, ne kroz ovaj endpoint).
  async accept(id: string, actor: { userId: string }): Promise<ClientContract> {
    const contract = await this.findOne(id);
    if (contract.status !== 'GENERATED') {
      throw new BadRequestException(`ClientContract ${id} nije u statusu GENERATED (status: ${contract.status}).`);
    }

    const updated = await this.prisma.clientContract.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedMethod: 'WET_SIGNATURE_SCAN' },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M20',
      action: 'client_contract.accepted',
      resourceType: 'ClientContract',
      resourceId: id,
      beforeState: contract,
      afterState: updated,
    });

    return updated;
  }

  // §5 — isključivo Vlasnik/Direktor, uvek ljudska radnja.
  async void(id: string, actor: { userId: string }): Promise<ClientContract> {
    const contract = await this.findOne(id);
    if (contract.status === 'VOIDED') {
      throw new BadRequestException(`ClientContract ${id} je već VOIDED.`);
    }

    const updated = await this.prisma.clientContract.update({
      where: { id },
      data: { status: 'VOIDED', voidedBy: actor.userId },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M20',
      action: 'client_contract.voided',
      resourceType: 'ClientContract',
      resourceId: id,
      beforeState: contract,
      afterState: updated,
    });

    return updated;
  }

  // M5 spec §6 dopuna (M20 §3.3) — vaučer za ORGANIZATOR rezervaciju čeka bar GENERATED ugovor.
  // Poziva se in-process iz M5 ClientContractBridgeService (isti obrazac kao M11 TravelGuaranteeService).
  async hasGeneratedContract(bookingId: string): Promise<boolean> {
    const contract = await this.prisma.clientContract.findFirst({
      where: { bookingId, status: { in: ['GENERATED', 'ACCEPTED'] } },
    });
    return contract !== null;
  }
}
