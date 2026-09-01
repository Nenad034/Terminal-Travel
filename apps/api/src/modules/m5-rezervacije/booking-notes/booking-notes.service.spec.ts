import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingNotesService } from './booking-notes.service';

// M5 spec §4.6 — interne beleške uz rezervaciju.
describe('BookingNotesService (M5 spec §4.6)', () => {
  function makeService() {
    const prisma: any = {
      bookingNote: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      userRole: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const auditLog = { write: jest.fn() };
    // `findOne` nosi vidljivost iz §6.6 — ovde se samo proverava da je pozvan.
    const bookings = { findOne: jest.fn().mockResolvedValue({ id: 'b1' }) };
    const service = new BookingNotesService(prisma, auditLog as any, bookings as any);
    return { service, prisma, auditLog, bookings };
  }

  it('lista beleški prolazi kroz vidljivost rezervacije i vraća najnoviju prvu', async () => {
    const { service, prisma, bookings } = makeService();
    prisma.bookingNote.findMany.mockResolvedValue([]);

    await service.findForBooking('b1', { userId: 'u1' });

    expect(bookings.findOne).toHaveBeenCalledWith('b1', 'u1');
    expect(prisma.bookingNote.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'b1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('created_by se uzima iz tokena, ne iz tela zahteva', async () => {
    const { service, prisma } = makeService();
    prisma.bookingNote.create.mockResolvedValue({ id: 'n1', bookingId: 'b1' });

    await service.create('b1', 'gost traži sobu na višem spratu', { userId: 'u1' });

    expect(prisma.bookingNote.create).toHaveBeenCalledWith({
      data: { bookingId: 'b1', body: 'gost traži sobu na višem spratu', createdBy: 'u1', origin: 'OFFICE' },
    });
  });

  // §4.6 dopuna (1.9.2026) — poreklo se izvodi iz uloge autora, ne iz tela zahteva.
  it('beleška zaposlenog u kancelariji dobija origin OFFICE', async () => {
    const { service, prisma } = makeService();
    prisma.userRole.findFirst.mockResolvedValue(null); // nije VODIC
    prisma.bookingNote.create.mockResolvedValue({ id: 'n1', bookingId: 'b1' });

    await service.create('b1', 'tekst', { userId: 'u1' });

    expect(prisma.bookingNote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ origin: 'OFFICE' }) }));
  });

  it('beleška predstavnika na destinaciji (VODIC) dobija origin FIELD_REP', async () => {
    const { service, prisma } = makeService();
    prisma.userRole.findFirst.mockResolvedValue({ id: 'ur-vodic' }); // ima VODIC ulogu
    prisma.bookingNote.create.mockResolvedValue({ id: 'n1', bookingId: 'b1' });

    await service.create('b1', 'gosti preuzeti na aerodromu', { userId: 'vodic-1' });

    expect(prisma.bookingNote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ origin: 'FIELD_REP' }) }));
  });

  it('kreiranje beleške upisuje audit zapis', async () => {
    const { service, prisma, auditLog } = makeService();
    prisma.bookingNote.create.mockResolvedValue({ id: 'n1', bookingId: 'b1' });

    await service.create('b1', 'tekst', { userId: 'u1' });

    expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'booking_note.created', resourceType: 'BookingNote', resourceId: 'n1' }));
  });

  it('autor sme da obriše sopstvenu belešku', async () => {
    const { service, prisma } = makeService();
    prisma.bookingNote.findUnique.mockResolvedValue({ id: 'n1', bookingId: 'b1', createdBy: 'u1' });

    await service.remove('b1', 'n1', { userId: 'u1' });

    expect(prisma.bookingNote.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
  });

  it('tuđu belešku ne sme da obriše onaj ko nije Vlasnik/Direktor', async () => {
    const { service, prisma } = makeService();
    prisma.bookingNote.findUnique.mockResolvedValue({ id: 'n1', bookingId: 'b1', createdBy: 'drugi' });

    await expect(service.remove('b1', 'n1', { userId: 'u1' })).rejects.toThrow(ForbiddenException);
    expect(prisma.bookingNote.delete).not.toHaveBeenCalled();
  });

  it('Vlasnik/Direktor sme da obriše tuđu belešku', async () => {
    const { service, prisma } = makeService();
    prisma.bookingNote.findUnique.mockResolvedValue({ id: 'n1', bookingId: 'b1', createdBy: 'drugi' });
    prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });

    await service.remove('b1', 'n1', { userId: 'u1' });

    expect(prisma.bookingNote.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
  });

  it('beleška sa druge rezervacije se ne može obrisati preko tuđeg bookingId-ja', async () => {
    const { service, prisma } = makeService();
    prisma.bookingNote.findUnique.mockResolvedValue({ id: 'n1', bookingId: 'DRUGA', createdBy: 'u1' });

    await expect(service.remove('b1', 'n1', { userId: 'u1' })).rejects.toThrow(NotFoundException);
    expect(prisma.bookingNote.delete).not.toHaveBeenCalled();
  });

  it('brisanje ne upisuje telo beleške u audit log (sadržaj se stvarno uklanja)', async () => {
    const { service, prisma, auditLog } = makeService();
    prisma.bookingNote.findUnique.mockResolvedValue({ id: 'n1', bookingId: 'b1', createdBy: 'u1', body: 'poverljiv tekst' });

    await service.remove('b1', 'n1', { userId: 'u1' });

    const call = auditLog.write.mock.calls[0][0];
    expect(call.action).toBe('booking_note.deleted');
    expect(JSON.stringify(call)).not.toContain('poverljiv tekst');
  });
});
