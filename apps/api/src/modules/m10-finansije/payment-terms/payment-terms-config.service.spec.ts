import { NotFoundException } from '@nestjs/common';
import { PaymentTermsConfigService } from './payment-terms-config.service';

describe('PaymentTermsConfigService (M10 spec §5.4.1)', () => {
  function makeService() {
    const prisma: any = { paymentTermsConfig: { findFirst: jest.fn(), create: jest.fn() } };
    const auditLog = { write: jest.fn() };
    const service = new PaymentTermsConfigService(prisma, auditLog as any);
    return { service, prisma, auditLog };
  }

  it('baca NotFoundException kad politika još nije podešena', async () => {
    const { service, prisma } = makeService();
    prisma.paymentTermsConfig.findFirst.mockResolvedValue(null);
    await expect(service.getActive()).rejects.toThrow(NotFoundException);
  });

  it('update kreira nov zapis (istorija, sistem čita najnoviji updated_at)', async () => {
    const { service, prisma, auditLog } = makeService();
    prisma.paymentTermsConfig.create.mockResolvedValue({ id: 'ptc-1', depositPercentage: 30 });

    await service.update(
      { depositPercentage: 30, depositDueDaysAfterConfirmation: 3, balanceDueDaysBeforeStay: 30, escalationDaysAfterDue: 5 },
      { userId: 'actor-1' },
    );

    expect(prisma.paymentTermsConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ depositPercentage: 30, updatedBy: 'actor-1' }),
    });
    expect(auditLog.write).toHaveBeenCalled();
  });
});
