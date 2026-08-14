import { ForbiddenException } from '@nestjs/common';
import { ModuleActivationService } from './module-activation.service';

// M15 spec §3, §5 — "uvek ljudska odluka" + defense-in-depth: čak i ako bi AI agent nekad
// dobio M1 dozvolu M15/module-activation/ACTIVATE (buduća greška), ovaj servis je i dalje
// odbija na nivou koda.
describe('ModuleActivationService (M15 spec §3, §5)', () => {
  function makeService() {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn() },
      moduleAgentActivation: { findUnique: jest.fn(), update: jest.fn() },
    };
    const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
    const service = new ModuleActivationService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  it('odbija pokušaj AI agenta da aktivira modul, čak i sa validnim user id-jem (defense in depth)', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'agent-1', accountType: 'AI_AGENT' });

    await expect(service.update('M15_OMNISEARCH', 'ACTIVATED', 'agent-1')).rejects.toThrow(ForbiddenException);
    expect(prisma.moduleAgentActivation.update).not.toHaveBeenCalled();
  });

  it('dozvoljava ljudskom korisniku (STAFF) da aktivira modul i upisuje audit trag', async () => {
    const { service, prisma, auditLog } = makeService();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'owner-1', accountType: 'STAFF' });
    prisma.moduleAgentActivation.findUnique.mockResolvedValue({
      moduleCode: 'M15_OMNISEARCH',
      status: 'READY_FOR_ACTIVATION',
      activatedBy: null,
      activatedAt: null,
    });
    prisma.moduleAgentActivation.update.mockResolvedValue({
      moduleCode: 'M15_OMNISEARCH',
      status: 'ACTIVATED',
      activatedBy: 'owner-1',
      activatedAt: new Date(),
    });

    const result = await service.update('M15_OMNISEARCH', 'ACTIVATED', 'owner-1');
    expect(result.status).toBe('ACTIVATED');
    expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'HUMAN', actorId: 'owner-1' }));
  });
});
