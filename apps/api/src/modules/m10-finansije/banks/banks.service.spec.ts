import { BanksService } from './banks.service';

describe('BanksService (M10 spec §5.2 dopuna 2.9.2026)', () => {
  it('findAll vraća samo aktivne banke, po imenu', async () => {
    const prisma: any = { bank: { findMany: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Banca Intesa' }]) } };
    const service = new BanksService(prisma);

    const result = await service.findAll();

    expect(prisma.bank.findMany).toHaveBeenCalledWith({ where: { active: true }, orderBy: { name: 'asc' } });
    expect(result).toEqual([{ id: 'b1', name: 'Banca Intesa' }]);
  });
});
