import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HrService } from './hr.service';

describe('HrService', () => {
  function makeService() {
    const prisma = {
      employeeRecord: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      leaveRecord: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      leaveEntitlement: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
    const service = new HrService(prisma as any, auditLog as any, permissions as any);
    return { service, prisma, auditLog, permissions };
  }

  const leaveDto = {
    type: 'GODISNJI_ODMOR' as const,
    startDate: '2026-09-01',
    endDate: '2026-09-03',
    daysCount: 3,
  };

  describe('createLeaveRecord (M24 spec §3a — samouslužni zahtev ili u ime drugog)', () => {
    it('odbija evidentiranje odsustva ako HR dosije još nije popunjen', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue(null);

      await expect(service.createLeaveRecord('user-1', leaveDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.leaveRecord.create).not.toHaveBeenCalled();
    });

    it('zaposleni sme da zatraži SOPSTVENO odsustvo bez ikakve dozvole (ownership)', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({ id: 'er-1' });
      prisma.leaveRecord.create.mockResolvedValue({ id: 'lv-1', status: 'PENDING' });

      await service.createLeaveRecord('user-1', leaveDto, 'user-1');

      expect(permissions.hasPermission).not.toHaveBeenCalled();
      expect(prisma.leaveRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
      );
    });

    it('odbija zahtev U IME drugog zaposlenog bez M24/leave-record/CREATE', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.createLeaveRecord('user-1', leaveDto, 'hr-actor')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.leaveRecord.create).not.toHaveBeenCalled();
    });

    it('dozvoljava zahtev U IME drugog zaposlenog sa M24/leave-record/CREATE', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      prisma.employeeRecord.findUnique.mockResolvedValue({ id: 'er-1' });
      prisma.leaveRecord.create.mockResolvedValue({ id: 'lv-1', status: 'PENDING' });

      await service.createLeaveRecord('user-1', leaveDto, 'hr-actor');

      expect(prisma.leaveRecord.create).toHaveBeenCalled();
    });
  });

  describe('approveLeaveRecord / rejectLeaveRecord (M24 spec §3a)', () => {
    function pendingLeave(overrides: Record<string, unknown> = {}) {
      return {
        id: 'lv-1',
        status: 'PENDING',
        employeeRecordId: 'er-1',
        employeeRecord: { reportsToUserId: 'manager-1' },
        ...overrides,
      };
    }

    it('dozvoljava odobrenje neposrednom rukovodiocu (ownership, bez dozvole)', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.leaveRecord.findUniqueOrThrow.mockResolvedValue(pendingLeave());
      prisma.leaveRecord.update.mockResolvedValue({ status: 'APPROVED' });

      await service.approveLeaveRecord('lv-1', 'manager-1');

      expect(permissions.hasPermission).not.toHaveBeenCalled();
      expect(prisma.leaveRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', approvedByUserId: 'manager-1' }),
        }),
      );
    });

    it('odbija odobrenje od nekog ko nije ni rukovodilac ni nosilac M24/leave-record/CREATE', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.leaveRecord.findUniqueOrThrow.mockResolvedValue(pendingLeave());
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.approveLeaveRecord('lv-1', 'stranac')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.leaveRecord.update).not.toHaveBeenCalled();
    });

    it('dozvoljava odobrenje nosiocu M24/leave-record/CREATE i kad nije rukovodilac (blanket)', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.leaveRecord.findUniqueOrThrow.mockResolvedValue(pendingLeave());
      permissions.hasPermission.mockResolvedValue(true);
      prisma.leaveRecord.update.mockResolvedValue({ status: 'APPROVED' });

      await service.approveLeaveRecord('lv-1', 'hr-actor');

      expect(prisma.leaveRecord.update).toHaveBeenCalled();
    });

    it('odbija odlučivanje o zahtevu koji više nije PENDING', async () => {
      const { service, prisma } = makeService();
      prisma.leaveRecord.findUniqueOrThrow.mockResolvedValue(pendingLeave({ status: 'APPROVED' }));

      await expect(service.approveLeaveRecord('lv-1', 'manager-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('odbijanje traži razlog (rejectionReason obavezan)', async () => {
      const { service } = makeService();

      await expect(service.rejectLeaveRecord('lv-1', '  ', 'manager-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('odbijanje sa razlogom upisuje REJECTED i rejectionReason', async () => {
      const { service, prisma } = makeService();
      prisma.leaveRecord.findUniqueOrThrow.mockResolvedValue(pendingLeave());
      prisma.leaveRecord.update.mockResolvedValue({ status: 'REJECTED' });

      await service.rejectLeaveRecord('lv-1', 'Poklapa se sa vrhom sezone', 'manager-1');

      expect(prisma.leaveRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectionReason: 'Poklapa se sa vrhom sezone',
          }),
        }),
      );
    });
  });

  describe('getLeaveBalance (M24 spec §2.3/§2.2a — izračunato po godini, broji samo APPROVED)', () => {
    it('vraća null vrednosti kad dosije uopšte ne postoji', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue(null);

      const result = await service.getLeaveBalance('user-1');

      expect(result).toEqual({ entitled: null, used: 0, remaining: null });
    });

    it('vraća null vrednosti kad NEMA LeaveEntitlement reda za traženu godinu (ne pogađa iz prethodne)', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({ id: 'er-1' });
      prisma.leaveEntitlement.findUnique.mockResolvedValue(null);

      const result = await service.getLeaveBalance('user-1', 2027);

      expect(result).toEqual({ entitled: null, used: 0, remaining: null });
    });

    it('preostalo = dodeljeno TE godine − suma GODISNJI_ODMOR te godine, samo APPROVED', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({ id: 'er-1' });
      prisma.leaveEntitlement.findUnique.mockResolvedValue({
        daysEntitled: 20,
        carriedOverDays: null,
        carriedOverExpiresAt: null,
      });
      prisma.leaveRecord.findMany.mockResolvedValue([{ daysCount: 3 }, { daysCount: 2 }]);

      const result = await service.getLeaveBalance('user-1', 2026);

      expect(result).toEqual({ entitled: 20, used: 5, remaining: 15 });
      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeRecordId: 'er-1',
            type: 'GODISNJI_ODMOR',
            status: 'APPROVED',
          }),
        }),
      );
    });

    it('dodaje carriedOverDays kad rok (carriedOverExpiresAt) još nije prošao', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({ id: 'er-1' });
      prisma.leaveEntitlement.findUnique.mockResolvedValue({
        daysEntitled: 20,
        carriedOverDays: 4,
        carriedOverExpiresAt: new Date('2099-06-30'),
      });
      prisma.leaveRecord.findMany.mockResolvedValue([]);

      const result = await service.getLeaveBalance('user-1', 2026);

      expect(result).toEqual({ entitled: 24, used: 0, remaining: 24 });
    });

    it('IGNORIŠE carriedOverDays kad je rok (carriedOverExpiresAt) već prošao', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({ id: 'er-1' });
      prisma.leaveEntitlement.findUnique.mockResolvedValue({
        daysEntitled: 20,
        carriedOverDays: 4,
        carriedOverExpiresAt: new Date('2020-06-30'),
      });
      prisma.leaveRecord.findMany.mockResolvedValue([]);

      const result = await service.getLeaveBalance('user-1', 2026);

      expect(result).toEqual({ entitled: 20, used: 0, remaining: 20 });
    });
  });

  describe('upsertLeaveEntitlement (M24 spec §2.2a — predlog v1.5, dodeljeno PO GODINI)', () => {
    it('odbija ako HR dosije zaposlenog još nije popunjen', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertLeaveEntitlement('user-1', 2026, { daysEntitled: 20 }, 'hr-actor'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.leaveEntitlement.upsert).not.toHaveBeenCalled();
    });

    it('upsert-uje red za (employeeRecordId, year) i piše audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({ id: 'er-1' });
      prisma.leaveEntitlement.findUnique.mockResolvedValue(null);
      prisma.leaveEntitlement.upsert.mockResolvedValue({
        id: 'le-1',
        year: 2026,
        daysEntitled: 20,
      });

      await service.upsertLeaveEntitlement('user-1', 2026, { daysEntitled: 20 }, 'hr-actor');

      expect(prisma.leaveEntitlement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeRecordId_year: { employeeRecordId: 'er-1', year: 2026 } },
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'leave-entitlement.created' }),
      );
    });
  });

  describe('getTeamCalendar (M24 spec §3b — vidljivost APPROVED/PENDING)', () => {
    function row(overrides: Record<string, unknown> = {}) {
      return {
        id: 'lv-1',
        type: 'GODISNJI_ODMOR',
        status: 'APPROVED',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-12'),
        daysCount: 3,
        note: 'tajna napomena',
        recordedByUserId: 'user-1',
        employeeRecordId: 'er-1',
        employeeRecord: {
          userId: 'user-1',
          reportsToUserId: 'manager-1',
          user: { id: 'user-1', fullName: 'Ana', branchId: null },
        },
        ...overrides,
      };
    }

    it('sakriva `note` od gledaoca koji nije ni vlasnik ni rukovodilac ni blanket', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(false);
      prisma.leaveRecord.findMany.mockResolvedValueOnce([row()]).mockResolvedValueOnce([]);

      const result = await service.getTeamCalendar('kolega', '2026-09-01', '2026-09-30');

      expect(result.approved[0].note).toBeNull();
    });

    it('pokazuje `note` vlasniku zapisa', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(false);
      prisma.leaveRecord.findMany.mockResolvedValueOnce([row()]).mockResolvedValueOnce([]);

      const result = await service.getTeamCalendar('user-1', '2026-09-01', '2026-09-30');

      expect(result.approved[0].note).toBe('tajna napomena');
    });

    it('PENDING upit se sužava na actor-relevantne zapise kad actor nema blanket ovlašćenje', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(false);
      prisma.leaveRecord.findMany.mockResolvedValue([]);

      await service.getTeamCalendar('kolega', '2026-09-01', '2026-09-30');

      const pendingCall = prisma.leaveRecord.findMany.mock.calls[1][0];
      expect(pendingCall.where.OR).toEqual([
        { recordedByUserId: 'kolega' },
        { employeeRecord: { reportsToUserId: 'kolega' } },
        { employeeRecord: { userId: 'kolega' } },
      ]);
    });

    it('PENDING upit NEMA ownership filter kad actor ima blanket ovlašćenje (M24/leave-record/CREATE)', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      prisma.leaveRecord.findMany.mockResolvedValue([]);

      await service.getTeamCalendar('hr-actor', '2026-09-01', '2026-09-30');

      const pendingCall = prisma.leaveRecord.findMany.mock.calls[1][0];
      expect(pendingCall.where.OR).toBeUndefined();
    });
  });
});
