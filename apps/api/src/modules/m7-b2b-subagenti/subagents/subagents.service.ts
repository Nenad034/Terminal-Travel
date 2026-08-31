import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Subagent } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { CreateSubagentDto } from './dto/create-subagent.dto';
import { ApproveSubagentDto } from './dto/approve-subagent.dto';
import { UpdateSubagentDto } from './dto/update-subagent.dto';
import { UpdateChildCommissionDto } from './dto/update-child-commission.dto';

interface CallerContext {
  isStaff: boolean;
  ownSubagentId: string | null;
}

// M7 spec §2.1/§3/§4/§6/§9 — Subagent (partner u B2B mreži). Vidljivost (§6) i kaskadna
// provizija (§3) se sprovode ovde, na nivou servisa — isti obrazac kao M5/M6 ownership provere
// preko resolveCallerIdentity (M5 §6.2 dopuna, M6 §7 dopuna).
@Injectable()
export class SubagentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // "own" ovde znači "sopstveni Subagent.id" — User.linked_profile_id za SUBAGENT_CONTACT
  // JESTE Subagent.id (common/auth/resolve-caller-identity.ts), za razliku od GUEST gde je
  // linked_profile_id ClientAccount.id.
  async resolveCallerContext(actorUserId: string): Promise<CallerContext> {
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);
    if (identity.accountType === 'SUBAGENT_CONTACT') {
      return { isStaff: false, ownSubagentId: identity.ownProfileId };
    }
    return { isStaff: true, ownSubagentId: null };
  }

  async findOneOrThrow(id: string): Promise<Subagent> {
    const subagent = await this.prisma.subagent.findUnique({ where: { id } });
    if (!subagent) throw new NotFoundException(`Subagent ${id} nije pronađen.`);
    return subagent;
  }

  async findById(id: string): Promise<Subagent | null> {
    return this.prisma.subagent.findUnique({ where: { id } });
  }

  async findByClientAccountId(clientAccountId: string): Promise<Subagent | null> {
    return this.prisma.subagent.findUnique({ where: { clientAccountId } });
  }

  // GET /subagents — "lista (agencija vidi sve)" (§11). SUBAGENT_CONTACT pozivalac (ako ikad
  // stigne do ove rute preko dozvole M7/subagent/VIEW, isti obrazac kao M6 GOST) dobija
  // isključivo sopstveni zapis, ne celu listu.
  async findMany(actor: { userId: string }) {
    const ctx = await this.resolveCallerContext(actor.userId);
    if (!ctx.isStaff) {
      if (!ctx.ownSubagentId) return [];
      const own = await this.prisma.subagent.findUnique({ where: { id: ctx.ownSubagentId } });
      return own ? [own] : [];
    }
    return this.prisma.subagent.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // GET /subagents/:id — §6: agencija vidi ceo lanac; subagent vidi sopstveni profil i profile
  // sopstvenih direktnih sub-subagenata (osnovni podaci — naziv/status/provizija/kredit, što je
  // sve što Subagent zapis i sadrži, bez rezervacija/gostiju).
  async findOne(id: string, actor: { userId: string }): Promise<Subagent> {
    const ctx = await this.resolveCallerContext(actor.userId);
    const subagent = await this.findOneOrThrow(id);
    if (ctx.isStaff) return subagent;
    if (subagent.id === ctx.ownSubagentId) return subagent;
    if (subagent.parentSubagentId === ctx.ownSubagentId) return subagent;
    throw new NotFoundException(`Subagent ${id} nije pronađen.`);
  }

  // POST /subagents — registracija Tier 1 kandidata (parent_subagent_id = null), status
  // PENDING_APPROVAL (§9). Zahteva M7/subagent/CREATE (Vlasnik/Direktor) na nivou kontrolera.
  async create(dto: CreateSubagentDto, actor: { userId: string }): Promise<Subagent> {
    const existing = await this.prisma.subagent.findUnique({ where: { clientAccountId: dto.clientAccountId } });
    if (existing) throw new BadRequestException(`ClientAccount ${dto.clientAccountId} već ima Subagent zapis.`);

    const account = await this.prisma.clientAccount.findUnique({ where: { id: dto.clientAccountId } });
    if (!account) throw new BadRequestException(`ClientAccount ${dto.clientAccountId} nije pronađen.`);
    if (account.accountType !== 'LEGAL_ENTITY') {
      throw new BadRequestException('Subagent mora biti ClientAccount sa account_type = LEGAL_ENTITY (M7 spec §2.1).');
    }

    const subagent = await this.prisma.subagent.create({
      data: {
        clientAccountId: dto.clientAccountId,
        status: 'PENDING_APPROVAL',
        commissionPercentage: dto.commissionPercentage ?? null,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M7',
      action: 'subagent.registered',
      resourceType: 'Subagent',
      resourceId: subagent.id,
      afterState: subagent,
    });

    return subagent;
  }

  // POST /subagents/:id/children — sub-subagent, dostupno agenciji ili roditeljskom
  // SUBAGENT_ADMIN-u (§11). Ograda §3 se primenjuje SAMO ako je commissionPercentage prosleđen.
  async createChild(parentId: string, dto: CreateSubagentDto, actor: { userId: string }): Promise<Subagent> {
    const ctx = await this.resolveCallerContext(actor.userId);
    if (!ctx.isStaff && ctx.ownSubagentId !== parentId) {
      throw new ForbiddenException('Samo agencija ili roditeljski subagent može kreirati sub-subagenta (M7 spec §3/§6).');
    }
    const parent = await this.findOneOrThrow(parentId);

    if (dto.commissionPercentage != null) {
      await this.assertCommissionWithinParentCeiling(parent, dto.commissionPercentage);
    }

    const existing = await this.prisma.subagent.findUnique({ where: { clientAccountId: dto.clientAccountId } });
    if (existing) throw new BadRequestException(`ClientAccount ${dto.clientAccountId} već ima Subagent zapis.`);
    const account = await this.prisma.clientAccount.findUnique({ where: { id: dto.clientAccountId } });
    if (!account) throw new BadRequestException(`ClientAccount ${dto.clientAccountId} nije pronađen.`);
    if (account.accountType !== 'LEGAL_ENTITY') {
      throw new BadRequestException('Subagent mora biti ClientAccount sa account_type = LEGAL_ENTITY (M7 spec §2.1).');
    }

    const child = await this.prisma.subagent.create({
      data: {
        clientAccountId: dto.clientAccountId,
        parentSubagentId: parentId,
        status: 'PENDING_APPROVAL',
        commissionPercentage: dto.commissionPercentage ?? null,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M7',
      action: 'subagent.child_registered',
      resourceType: 'Subagent',
      resourceId: child.id,
      afterState: child,
      context: { parentSubagentId: parentId },
    });

    return child;
  }

  // GET /subagents/:id/children — §6: samo direktna deca (ne unuci), dostupno agenciji i
  // roditeljskom SUBAGENT_ADMIN-u.
  async children(parentId: string, actor: { userId: string }): Promise<Subagent[]> {
    const ctx = await this.resolveCallerContext(actor.userId);
    if (!ctx.isStaff && ctx.ownSubagentId !== parentId) {
      throw new ForbiddenException('Samo agencija ili roditeljski subagent može videti sopstvenu mrežu (M7 spec §6).');
    }
    await this.findOneOrThrow(parentId);
    return this.prisma.subagent.findMany({ where: { parentSubagentId: parentId }, orderBy: { createdAt: 'desc' } });
  }

  // PATCH /subagents/:id/children/:childId/commission — §3: isključivo roditeljski subagent
  // (ili agencija, koja sme sve), ograda: dete <= roditeljeva TRENUTNA efektivna provizija.
  // effectiveParentCommission se prosleđuje spolja (SubagentVolumeStatusService) da ovaj servis
  // ne mora da zavisi od komisionog modula — izbegava kružnu zavisnost modula.
  async updateChildCommission(
    parentId: string,
    childId: string,
    dto: UpdateChildCommissionDto,
    actor: { userId: string },
    effectiveParentCommission: number,
  ): Promise<Subagent> {
    const ctx = await this.resolveCallerContext(actor.userId);
    if (!ctx.isStaff && ctx.ownSubagentId !== parentId) {
      throw new ForbiddenException('Samo agencija ili roditeljski subagent može menjati proviziju sub-subagenta (M7 spec §3).');
    }
    const child = await this.findOneOrThrow(childId);
    if (child.parentSubagentId !== parentId) {
      throw new BadRequestException(`Subagent ${childId} nije direktno dete subagenta ${parentId}.`);
    }
    if (dto.commissionPercentage > effectiveParentCommission) {
      throw new BadRequestException(
        `Provizija deteta (${dto.commissionPercentage}%) ne sme preći trenutnu efektivnu proviziju roditelja (${effectiveParentCommission}%) — M7 spec §3.`,
      );
    }

    const before = child;
    const updated = await this.prisma.subagent.update({ where: { id: childId }, data: { commissionPercentage: dto.commissionPercentage } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M7',
      action: 'subagent.child_commission_updated',
      resourceType: 'Subagent',
      resourceId: childId,
      beforeState: { commissionPercentage: before.commissionPercentage },
      afterState: { commissionPercentage: updated.commissionPercentage },
    });

    return updated;
  }

  private async assertCommissionWithinParentCeiling(parent: Subagent, childCommission: number): Promise<void> {
    if (parent.commissionPercentage == null || childCommission > Number(parent.commissionPercentage)) {
      throw new BadRequestException(
        `Provizija deteta (${childCommission}%) ne sme preći proviziju roditelja (M7 spec §3).`,
      );
    }
  }

  // POST /subagents/:id/approve — §9: Vlasnik/Direktor postavlja kreditni limit UVEK, i
  // proviziju SAMO ako je Tier 1 (parent_subagent_id null). Sub-subagentu proviziju već
  // postavlja/postavlja roditelj (kreacija ili PATCH .../commission) — approve ovde ne sme
  // tiho da je pregazi ako nije eksplicitno poslata.
  async approve(id: string, dto: ApproveSubagentDto, actor: { userId: string }): Promise<Subagent> {
    const subagent = await this.findOneOrThrow(id);
    if (subagent.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Subagent ${id} nije u statusu PENDING_APPROVAL (status: ${subagent.status}).`);
    }

    const isTier1 = subagent.parentSubagentId === null;
    if (isTier1 && dto.commissionPercentage == null && subagent.commissionPercentage == null) {
      throw new BadRequestException('Tier 1 subagent zahteva commissionPercentage pri odobravanju (M7 spec §3/§9).');
    }

    const updated = await this.prisma.subagent.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        creditLimit: dto.creditLimit,
        creditLimitCurrency: dto.creditLimitCurrency,
        commissionPercentage: isTier1 ? (dto.commissionPercentage ?? subagent.commissionPercentage) : subagent.commissionPercentage,
        // M7 spec §2.0.7 (31.8.2026) — franšizna privilegija se bira isključivo ovde, pri
        // odobravanju; podrazumevano ostaje STANDARD ako se ne prosledi.
        privilegeLevel: dto.privilegeLevel ?? subagent.privilegeLevel,
        approvedBy: actor.userId,
        approvedAt: new Date(),
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M7',
      action: 'subagent.approved',
      resourceType: 'Subagent',
      resourceId: id,
      beforeState: subagent,
      afterState: updated,
    });

    return updated;
  }

  // PATCH /subagents/:id — §10 M7/subagent/EDIT (Vlasnik/Direktor): kreditni limit / status.
  async update(id: string, dto: UpdateSubagentDto, actor: { userId: string }): Promise<Subagent> {
    const before = await this.findOneOrThrow(id);
    const updated = await this.prisma.subagent.update({
      where: { id },
      data: {
        creditLimit: dto.creditLimit ?? undefined,
        creditLimitCurrency: dto.creditLimitCurrency ?? undefined,
        status: dto.status ?? undefined,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M7',
      action: 'subagent.updated',
      resourceType: 'Subagent',
      resourceId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  }

  // §2.1 — current_outstanding_balance: uživo, zbir Booking.total_price za rezervacije ovog
  // client_account_id čiji je payment_status u (UNPAID, PARTIALLY_PAID, INVOICE_PENDING),
  // umanjen za primljene (RECEIVED) uplate (M10 Payment) na te rezervacije. Mehanička dopuna
  // (avgust 2026, isti obrazac kao M6 §3.2 TOTAL_SPEND_RSD): FX konverzija između valuta nije
  // definisana ovom specifikacijom, pa se u obzir uzimaju samo rezervacije u valuti kreditnog
  // limita — druge valute se ignorišu dok se ne pokaže potreba za konverzijom.
  async outstandingBalance(id: string): Promise<{ amount: number; currency: string | null }> {
    const subagent = await this.findOneOrThrow(id);
    if (!subagent.creditLimitCurrency) return { amount: 0, currency: null };

    const bookings = await this.prisma.booking.findMany({
      where: {
        clientAccountId: subagent.clientAccountId,
        status: { not: 'CANCELLED' },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID', 'INVOICE_PENDING'] },
        currency: subagent.creditLimitCurrency,
      },
      select: { id: true, totalPrice: true },
    });

    const totalOwed = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const bookingIds = bookings.map((b) => b.id);
    const paymentsAgg = bookingIds.length
      ? await this.prisma.payment.aggregate({ where: { bookingId: { in: bookingIds }, status: 'RECEIVED' }, _sum: { amount: true } })
      : { _sum: { amount: 0 } };
    const received = paymentsAgg._sum.amount ?? 0;

    return { amount: Math.max(0, totalOwed - received), currency: subagent.creditLimitCurrency };
  }
}
