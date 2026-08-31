import { NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';

// Fokusiran na VIEW_ALL vidljivost za interni tim (§6 dopuna, 31.8.2026, M1 §3.9a konvencija) —
// ostatak servisa (kreiranje/poruke/ZZP rok) nema pre-postojeći test fajl, van obima ovog prolaza.
describe('TicketsService — findMany/findOne VIEW_ALL za interni tim (§6 dopuna, 31.8.2026)', () => {
  function makeService() {
    const prisma: any = {
      ticket: { findMany: jest.fn(), findUnique: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null }) },
      subagent: { findUnique: jest.fn() },
      booking: { findUnique: jest.fn() },
    };
    const eventBus = { emit: jest.fn() };
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const service = new TicketsService(prisma, eventBus as any, permissions as any);
    return { service, prisma, permissions };
  }

  it('STAFF sa VIEW_ALL=true vidi sve tikete, bez filtera po zaduženju', async () => {
    const { service, prisma, permissions } = makeService();
    permissions.hasPermission.mockResolvedValue(true);
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.findMany('staff-1');

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });

  it('STAFF sužen (VIEW_ALL=false) vidi samo tikete gde je assigned_to = pozivalac', async () => {
    const { service, prisma, permissions } = makeService();
    permissions.hasPermission.mockResolvedValue(false);
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.findMany('staff-1');

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { assignedTo: 'staff-1' } }));
  });

  it('findOne — sužen STAFF ne vidi tiket dodeljen nekom drugom, vraća 404', async () => {
    const { service, prisma, permissions } = makeService();
    permissions.hasPermission.mockResolvedValue(false);
    prisma.ticket.findUnique.mockResolvedValue({ id: 't1', requesterClientAccountId: null, assignedTo: 'neko-drugi', relatedBookingId: null });

    await expect(service.findOne('t1', 'staff-1')).rejects.toThrow(NotFoundException);
  });

  it('findOne — sužen STAFF vidi tiket na kome je zadužen', async () => {
    const { service, prisma, permissions } = makeService();
    permissions.hasPermission.mockResolvedValue(false);
    prisma.ticket.findUnique.mockResolvedValue({ id: 't1', requesterClientAccountId: null, assignedTo: 'staff-1', relatedBookingId: null });

    const result = await service.findOne('t1', 'staff-1');
    expect(result.id).toBe('t1');
  });

  it('Gost (samoposlužni put) i dalje radi po sopstvenom ownership-u, ne po VIEW_ALL', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.findMany('guest-1');

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterClientAccountId: 'acc-1' } }),
    );
    expect(permissions.hasPermission).not.toHaveBeenCalled();
  });
});
