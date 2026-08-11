import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  function makeService() {
    const prisma = {
      supplier: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
      supplierContact: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const service = new SuppliersService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('create (M3 spec §2.1)', () => {
    it('kreira dobavljača kao ACTIVE i upisuje audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      const created = { id: 's1', name: 'Hotel Test' };
      prisma.supplier.create.mockResolvedValue(created);

      const result = await service.create(
        {
          name: 'Hotel Test',
          type: 'HOTEL' as any,
          taxId: '123',
          registrationNumber: '456',
          country: 'Srbija',
          contactName: 'Marko',
          contactEmail: 'marko@hotel.rs',
          contactPhone: '060123456',
        },
        'actor-1',
      );

      expect(prisma.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE', name: 'Hotel Test' }) }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'supplier.created', module: 'M3' }));
      expect(result).toBe(created);
    });
  });

  describe('createContact (M3 spec §2.1a)', () => {
    it('kreira kontakt-osobu kao ACTIVE, bez linked_user_id (popunjava se samo kroz M19 tok)', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.supplierContact.create.mockResolvedValue({ id: 'c1' });

      await service.createContact('s1', { fullName: 'Ana', email: 'ana@hotel.rs', phone: '060' }, 'actor-1');

      const call = prisma.supplierContact.create.mock.calls[0][0];
      expect(call.data.status).toBe('ACTIVE');
      expect(call.data.linkedUserId).toBeUndefined();
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'supplier_contact.created' }));
    });
  });

  describe('updateContact', () => {
    it('upisuje audit log sa before/after stanjem', async () => {
      const { service, prisma, auditLog } = makeService();
      const before = { id: 'c1', status: 'ACTIVE' };
      const after = { id: 'c1', status: 'INACTIVE' };
      prisma.supplierContact.findUniqueOrThrow.mockResolvedValue(before);
      prisma.supplierContact.update.mockResolvedValue(after);

      const result = await service.updateContact('c1', { status: 'INACTIVE' as any }, 'actor-1');

      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'supplier_contact.updated', beforeState: before, afterState: after }),
      );
      expect(result).toBe(after);
    });
  });
});
