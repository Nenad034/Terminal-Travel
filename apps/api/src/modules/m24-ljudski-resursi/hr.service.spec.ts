import { BadRequestException } from '@nestjs/common';
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
      },
    };
    const auditLog = { write: jest.fn() };
    const service = new HrService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('createLeaveRecord (M24 spec §2.3)', () => {
    it('odbija evidentiranje odsustva ako HR dosije još nije popunjen', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.createLeaveRecord(
          'user-1',
          { type: 'GODISNJI_ODMOR', startDate: '2026-09-01', endDate: '2026-09-03', daysCount: 3 },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.leaveRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('getLeaveBalance (M24 spec §2.3 — izračunato, ne čuvano polje)', () => {
    it('vraća null vrednosti kad dosije nema dodeljene dane', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({
        id: 'er-1',
        annualLeaveDaysEntitled: null,
      });

      const result = await service.getLeaveBalance('user-1');

      expect(result).toEqual({ entitled: null, used: 0, remaining: null });
    });

    it('preostalo = dodeljeno − suma GODISNJI_ODMOR tekuće godine', async () => {
      const { service, prisma } = makeService();
      prisma.employeeRecord.findUnique.mockResolvedValue({
        id: 'er-1',
        annualLeaveDaysEntitled: 20,
      });
      prisma.leaveRecord.findMany.mockResolvedValue([{ daysCount: 3 }, { daysCount: 2 }]);

      const result = await service.getLeaveBalance('user-1');

      expect(result).toEqual({ entitled: 20, used: 5, remaining: 15 });
      // Filtrirano na GODISNJI_ODMOR tekuće godine — bolovanje/neplaćeno ne umanjuju odmor.
      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeRecordId: 'er-1', type: 'GODISNJI_ODMOR' }),
        }),
      );
    });
  });
});
