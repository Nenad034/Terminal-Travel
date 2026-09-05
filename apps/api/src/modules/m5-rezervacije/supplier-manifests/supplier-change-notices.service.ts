import { Injectable, NotFoundException } from '@nestjs/common';
import { SupplierChangeNoticeType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { SupplierMailboxService } from '../common/supplier-mailbox.service';
import { nextReferenceCode } from '../common/reference-code';

/**
 * M5 spec §8.8 — `SupplierChangeNotice`. Za razliku od nove rezervacije (SupplierManifest,
 * poglavlje 8.4/8.5), izmena/storno pojedinačne stavke ne čeka sledeću rutinsku listu —
 * dobavljač mora EKSPLICITNO biti obavešten (direktna pouka iz problema #10, §6.4).
 */
@Injectable()
export class SupplierChangeNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailbox: SupplierMailboxService,
  ) {}

  // Priprema DRAFT je nivo "Autonomno" (§8.8) — okidač je promena item_status na
  // MODIFIED/CANCELLED (poglavlje 6), pozvano iz BookingsService.cancel()/modify().
  async prepareDraft(bookingItemId: string, noticeType: SupplierChangeNoticeType) {
    const referenceCode = await nextReferenceCode(this.prisma);
    return this.prisma.supplierChangeNotice.create({
      data: { bookingItemId, noticeType, referenceCode, status: 'DRAFT' },
    });
  }

  // Dopuna 5.9.2026 — ekran u panelu treba da zna KOME se šalje, a adresa dobavljača se dobija
  // tek kroz lanac stavka → proizvod → ugovor → dobavljač. Bez ovoga bi operater morao ručno da
  // kuca mejl hotela pri svakom slanju, što je tačno mesto gde se prave greške.
  findAll(bookingItemId?: string) {
    return this.prisma.supplierChangeNotice.findMany({
      where: { bookingItemId },
      orderBy: { createdAt: 'desc' },
      include: {
        bookingItem: {
          select: {
            id: true,
            stayFrom: true,
            stayTo: true,
            booking: { select: { id: true, bookingNumber: true } },
            // `Product` nema polje `name` (nazivi žive u prevodima, M2 §2.2) — za ovaj ekran je
            // dovoljno ko je dobavljač i koje je mesto; naziv objekta se vidi u samoj rezervaciji.
            product: { select: { type: true, destinationCity: true, sourceContract: { select: { supplier: { select: { id: true, name: true, contactEmail: true } } } } } },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const notice = await this.prisma.supplierChangeNotice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException(`SupplierChangeNotice ${id} nije pronađen.`);
    return notice;
  }

  // Slanje ostaje "Predloži pa čovek odobri" — isti princip kao §8.4, NIKAD AI agent (§10).
  async send(id: string, supplierEmail: string, actorId: string) {
    const notice = await this.findOne(id);
    // §8.4 (5.9.2026) — kao i kod operativne liste, PENDING_SEND se sme poslati ponovo.
    if (notice.status !== 'DRAFT' && notice.status !== 'PENDING_SEND') {
      throw new NotFoundException(`SupplierChangeNotice ${id} nije u statusu DRAFT ni PENDING_SEND.`);
    }

    const result = await this.mailbox.sendViaSharedMailbox({
      toEmail: supplierEmail,
      referenceCode: notice.referenceCode,
      subject: notice.noticeType === 'CANCELLATION' ? 'Storno rezervacije' : 'Izmena rezervacije',
      supplierChangeNoticeId: notice.id,
      actorUserId: actorId,
    });

    // §8.4 (5.9.2026, dok. 39 nalaz 1.2) — `sent_at` samo za stvarno poslato. Ovo je važnije
    // ovde nego kod operativne liste: §8.6 dozvoljava unos potvrde dobavljača ISKLJUČIVO nad
    // porukom u statusu SENT, pa neisporučena izmena ne može ni greškom biti „potvrđena".
    const updated = result.delivered
      ? await this.prisma.supplierChangeNotice.update({
          where: { id },
          data: { status: 'SENT', sentAt: new Date(), sentBy: actorId },
        })
      : await this.prisma.supplierChangeNotice.update({
          where: { id },
          data: { status: 'PENDING_SEND', sentBy: actorId },
        });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: result.delivered ? 'supplier_change_notice.sent' : 'supplier_change_notice.send_pending',
      resourceType: 'SupplierChangeNotice',
      resourceId: id,
      afterState: updated,
      context: result.delivered ? {} : { reason: result.reason ?? null },
    });
    return updated;
  }

  // M5 spec §8.8 — potvrda dobavljača ISKLJUČIVO ljudskim klikom, nikad automatski.
  async confirmSupplier(id: string, actorId: string) {
    const notice = await this.findOne(id);
    if (notice.status !== 'SENT') throw new NotFoundException(`SupplierChangeNotice ${id} nije poslat.`);

    const updated = await this.prisma.supplierChangeNotice.update({
      where: { id },
      data: { supplierConfirmedAt: new Date(), supplierConfirmedBy: actorId },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'supplier_change_notice.supplier_confirmed',
      resourceType: 'SupplierChangeNotice',
      resourceId: id,
      afterState: updated,
      context: {},
    });
    return updated;
  }
}
