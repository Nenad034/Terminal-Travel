import { Injectable, NotFoundException } from '@nestjs/common';
import { SupplierChangeNoticeType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { M22MailboxStubService } from '../common/m22-mailbox-stub.service';
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
    private readonly mailbox: M22MailboxStubService,
  ) {}

  // Priprema DRAFT je nivo "Autonomno" (§8.8) — okidač je promena item_status na
  // MODIFIED/CANCELLED (poglavlje 6), pozvano iz BookingsService.cancel()/modify().
  async prepareDraft(bookingItemId: string, noticeType: SupplierChangeNoticeType) {
    const referenceCode = await nextReferenceCode(this.prisma);
    return this.prisma.supplierChangeNotice.create({
      data: { bookingItemId, noticeType, referenceCode, status: 'DRAFT' },
    });
  }

  findAll(bookingItemId?: string) {
    return this.prisma.supplierChangeNotice.findMany({ where: { bookingItemId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const notice = await this.prisma.supplierChangeNotice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException(`SupplierChangeNotice ${id} nije pronađen.`);
    return notice;
  }

  // Slanje ostaje "Predloži pa čovek odobri" — isti princip kao §8.4, NIKAD AI agent (§10).
  async send(id: string, supplierEmail: string, actorId: string) {
    const notice = await this.findOne(id);
    if (notice.status !== 'DRAFT') throw new NotFoundException(`SupplierChangeNotice ${id} nije u statusu DRAFT.`);

    await this.mailbox.sendViaSharedMailbox({
      toEmail: supplierEmail,
      referenceCode: notice.referenceCode,
      subject: notice.noticeType === 'CANCELLATION' ? 'Storno rezervacije' : 'Izmena rezervacije',
    });

    const updated = await this.prisma.supplierChangeNotice.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), sentBy: actorId },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'supplier_change_notice.sent',
      resourceType: 'SupplierChangeNotice',
      resourceId: id,
      afterState: updated,
      context: {},
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
