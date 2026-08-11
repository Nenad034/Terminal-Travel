import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { M22MailboxStubService } from '../common/m22-mailbox-stub.service';
import { nextReferenceCode } from '../common/reference-code';
import { GenerateManifestDto } from './dto/generate-manifest.dto';

/**
 * M5 spec §8 — operativne liste za dobavljače (CONTRACTED stavke). Cena/marža se NIKAD
 * ne uključuje (§8.3, ograda) — ova service namerno ne selektuje base_cost/final_price
 * u payload liste.
 */
@Injectable()
export class SupplierManifestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailbox: M22MailboxStubService,
  ) {}

  findAll(supplierId?: string) {
    return this.prisma.supplierManifest.findMany({ where: { supplierId }, orderBy: { generatedAt: 'desc' } });
  }

  async findOne(id: string) {
    const manifest = await this.prisma.supplierManifest.findUnique({
      where: { id },
      include: { items: { include: { bookingItem: { include: { guests: true } } } } },
    });
    if (!manifest) throw new NotFoundException(`SupplierManifest ${id} nije pronađen.`);
    return manifest;
  }

  // §8.4 — priprema DRAFT nacrta agregacijom CONFIRMED CONTRACTED stavki po dobavljaču+periodu.
  // generatedBy može biti "AI_AGENT_M5" (automatska periodična priprema) ili stvaran user id.
  async generateDraft(dto: GenerateManifestDto, generatedBy: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException(`Supplier ${dto.supplierId} nije pronađen.`);

    const periodFrom = new Date(dto.periodFrom);
    const periodTo = new Date(dto.periodTo);

    // Stavke ovog dobavljača (preko product -> sourceContract -> supplierId), CONFIRMED,
    // koje se preklapaju sa traženim periodom, i koje NISU već na nekoj ne-SUPERSEDED listi.
    const candidateItems = await this.prisma.bookingItem.findMany({
      where: {
        sourceType: 'CONTRACTED',
        itemStatus: 'CONFIRMED',
        stayFrom: { lte: periodTo },
        stayTo: { gte: periodFrom },
        ...(dto.contractPeriodId
          ? { rateLine: { contractPeriodId: dto.contractPeriodId } }
          : {}),
        product: { sourceContract: { supplierId: dto.supplierId } },
        manifestEntries: { none: { supplierManifest: { status: { not: 'SUPERSEDED' } } } },
      },
    });

    if (candidateItems.length === 0) {
      throw new BadRequestException('Nema potvrđenih CONTRACTED stavki za ovog dobavljača u traženom periodu.');
    }

    const referenceCode = await nextReferenceCode(this.prisma);
    const manifest = await this.prisma.supplierManifest.create({
      data: {
        supplierId: dto.supplierId,
        contractPeriodId: dto.contractPeriodId,
        supplierTypeSnapshot: supplier.type,
        language: dto.language ?? 'SR',
        periodFrom,
        periodTo,
        status: 'DRAFT',
        generatedBy,
        referenceCode,
        items: { create: candidateItems.map((item) => ({ bookingItemId: item.id })) },
      },
      include: { items: true },
    });

    await this.auditLog.write({
      actorType: generatedBy === 'AI_AGENT_M5' ? 'AI_AGENT' : 'HUMAN',
      actorId: generatedBy === 'AI_AGENT_M5' ? null : generatedBy,
      module: 'M5',
      action: 'supplier_manifest.draft_generated',
      resourceType: 'SupplierManifest',
      resourceId: manifest.id,
      afterState: manifest,
      context: {},
    });

    return manifest;
  }

  // §8.4/§10 — slanje zahteva M5/supplier-manifest/SEND, NIKAD AI agent.
  async send(id: string, actorId: string) {
    const manifest = await this.findOne(id);
    if (manifest.status !== 'DRAFT') throw new BadRequestException(`SupplierManifest ${id} nije u statusu DRAFT.`);
    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: manifest.supplierId } });

    await this.mailbox.sendViaSharedMailbox({
      toEmail: supplier.contactEmail,
      referenceCode: manifest.referenceCode ?? '',
      subject: `Operativna lista — ${supplier.name}`,
      documentUrl: manifest.documentUrl,
    });

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.supplierManifest.update({
        where: { id },
        data: { status: 'SENT', sentAt: now, sentBy: actorId, sentToEmail: supplier.contactEmail },
      }),
      // §8.6 — announced_at se popunjava na svakoj obuhvaćenoj BookingItem.
      this.prisma.bookingItem.updateMany({
        where: { id: { in: manifest.items.map((i) => i.bookingItemId) } },
        data: { announcedAt: now },
      }),
    ]);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'supplier_manifest.sent',
      resourceType: 'SupplierManifest',
      resourceId: id,
      afterState: updated,
      context: {},
    });
    return updated;
  }

  // §8.6 — ručni unos potvrde dobavljača, popunjava sve stavke te liste.
  async confirmSupplier(id: string, actorId: string) {
    const manifest = await this.findOne(id);
    if (manifest.status !== 'SENT') throw new BadRequestException(`SupplierManifest ${id} nije poslat.`);
    const now = new Date();

    await this.prisma.bookingItem.updateMany({
      where: { id: { in: manifest.items.map((i) => i.bookingItemId) } },
      data: { supplierConfirmedAt: now, supplierConfirmedBy: actorId },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'supplier_manifest.supplier_confirmed',
      resourceType: 'SupplierManifest',
      resourceId: id,
      context: {},
    });
    return this.findOne(id);
  }

  /**
   * M5 spec §8.5 — "izmene posle slanja": ako stavka na već poslatoj (SENT) listi bude
   * izmenjena/otkazana (poglavlje 6), postojeća lista se SUPERSEDED, priprema se nova
   * DRAFT sa preostalim (i dalje aktivnim) stavkama, supersedes_manifest_id ka prethodnoj.
   * Poziva se iz BookingsService.cancel()/modify() posle promene item_status.
   */
  async supersedeIfOnSentManifest(bookingItemId: string, generatedBy: string) {
    const entry = await this.prisma.supplierManifestItem.findFirst({
      where: { bookingItemId, supplierManifest: { status: 'SENT' } },
      include: { supplierManifest: { include: { items: true } } },
    });
    if (!entry) return null;

    const oldManifest = entry.supplierManifest;
    const remainingItemIds = (
      await this.prisma.bookingItem.findMany({
        where: { id: { in: oldManifest.items.map((i) => i.bookingItemId) }, itemStatus: { not: 'CANCELLED' } },
        select: { id: true },
      })
    ).map((i) => i.id);

    const referenceCode = await nextReferenceCode(this.prisma);
    const [, newManifest] = await this.prisma.$transaction([
      this.prisma.supplierManifest.update({ where: { id: oldManifest.id }, data: { status: 'SUPERSEDED' } }),
      this.prisma.supplierManifest.create({
        data: {
          supplierId: oldManifest.supplierId,
          contractPeriodId: oldManifest.contractPeriodId,
          supplierTypeSnapshot: oldManifest.supplierTypeSnapshot,
          language: oldManifest.language, // §8.3 — jezik se NE menja na revizijama
          periodFrom: oldManifest.periodFrom,
          periodTo: oldManifest.periodTo,
          status: 'DRAFT',
          generatedBy,
          referenceCode,
          supersedesManifestId: oldManifest.id,
          items: { create: remainingItemIds.map((bookingItemId) => ({ bookingItemId })) },
        },
      }),
    ]);

    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M5',
      action: 'supplier_manifest.superseded',
      resourceType: 'SupplierManifest',
      resourceId: oldManifest.id,
      afterState: { supersededBy: newManifest.id },
      context: { bookingItemId },
    });

    return newManifest;
  }
}
