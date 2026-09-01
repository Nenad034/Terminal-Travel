import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { SYSTEM_ROLES } from '../../m1-core-identitet/roles/system-roles.constants';
import { BookingsService } from '../bookings/bookings.service';

// M5 spec §4.6 — interne beleške uz rezervaciju.
@Injectable()
export class BookingNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly bookings: BookingsService,
  ) {}

  private async isVlasnikOrDirektor(userId: string): Promise<boolean> {
    const match = await this.prisma.userRole.findFirst({
      where: { userId, role: { name: { in: [SYSTEM_ROLES.VLASNIK, SYSTEM_ROLES.DIREKTOR] } } },
    });
    return Boolean(match);
  }

  /** Beleške se vide sa rezervacijom — ista vidljivost kao §6.6 (`findOne` je primenjuje),
   * pa nema zasebne VIEW dozvole. Najnovija prva. */
  async findForBooking(bookingId: string, actor: { userId: string }) {
    await this.bookings.findOne(bookingId, actor.userId);
    return this.prisma.bookingNote.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(bookingId: string, body: string, actor: { userId: string }) {
    await this.bookings.findOne(bookingId, actor.userId);
    const note = await this.prisma.bookingNote.create({
      data: { bookingId, body, createdBy: actor.userId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking_note.created',
      resourceType: 'BookingNote',
      resourceId: note.id,
      beforeState: null,
      afterState: { bookingId },
      context: {},
    });
    return note;
  }

  /** Autor sme sopstvenu, Vlasnik/Direktor bilo koju (§4.6). Sadržaj se briše, trag u audit logu
   * ostaje — namerno bez tela beleške u `beforeState` da brisanje stvarno ukloni sadržaj. */
  async remove(bookingId: string, noteId: string, actor: { userId: string }) {
    await this.bookings.findOne(bookingId, actor.userId);
    const note = await this.prisma.bookingNote.findUnique({ where: { id: noteId } });
    if (!note || note.bookingId !== bookingId) {
      throw new NotFoundException(`Beleška ${noteId} nije pronađena na rezervaciji ${bookingId}.`);
    }
    if (note.createdBy !== actor.userId && !(await this.isVlasnikOrDirektor(actor.userId))) {
      throw new ForbiddenException('Belešku sme da obriše samo njen autor ili Vlasnik/Direktor (M5 spec §4.6).');
    }
    await this.prisma.bookingNote.delete({ where: { id: noteId } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking_note.deleted',
      resourceType: 'BookingNote',
      resourceId: noteId,
      beforeState: { bookingId, createdBy: note.createdBy },
      afterState: null,
      context: {},
    });
    return { deleted: true };
  }
}
