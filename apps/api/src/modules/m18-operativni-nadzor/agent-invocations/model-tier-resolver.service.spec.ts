import { ModelTierResolverService } from './model-tier-resolver.service';

// M18 spec §6.2a/§6.5 izlazni kriterijum §10 — §6.2a floor pravilo, §6.5 degradacija +
// izuzetak za security-critical akcije, i "jači od dva kriterijuma pobeđuje" kad se razlikuju.
describe('ModelTierResolverService (M18 spec §6.2a, §6.5)', () => {
  function makeService(overrides?: { agentBudgets?: any[]; providerQuotas?: any[] }) {
    const prisma = {
      aIAgentBudget: { findMany: jest.fn().mockResolvedValue(overrides?.agentBudgets ?? []) },
      aIProviderQuota: { findMany: jest.fn().mockResolvedValue(overrides?.providerQuotas ?? []) },
    };
    return { service: new ModelTierResolverService(prisma as any), prisma };
  }

  const baseParams = { agentId: 'agent-1', providerName: 'ANTHROPIC' };

  it('§6.2a — akcija koja nije bezbednosno-kritična zadržava traženi nivo bez izmene (nema degradacije)', async () => {
    const { service } = makeService();
    const result = await service.resolve({ ...baseParams, requestedTier: 'LIGHT', securityCritical: false });
    expect(result).toEqual({ tier: 'LIGHT', degradedButExempt: false });
  });

  it('§6.2a — bezbednosno-kritična akcija sa traženim LIGHT se podiže na HEAVY (difolt)', async () => {
    const { service } = makeService();
    const result = await service.resolve({ ...baseParams, requestedTier: 'LIGHT', securityCritical: true });
    expect(result.tier).toBe('HEAVY');
  });

  it('§6.2a — bezbednosno-kritična akcija sa traženim STANDARD ostaje STANDARD (floor je STANDARD, ne prisilno HEAVY)', async () => {
    const { service } = makeService();
    const result = await service.resolve({ ...baseParams, requestedTier: 'STANDARD', securityCritical: true });
    expect(result.tier).toBe('STANDARD');
  });

  it('§6.5 — provajder u DEGRADED stanju prisiljava LIGHT za akciju koja nije bezbednosno-kritična', async () => {
    const { service } = makeService({ providerQuotas: [{ enforcementState: 'DEGRADED' }] });
    const result = await service.resolve({ ...baseParams, requestedTier: 'STANDARD', securityCritical: false });
    expect(result).toEqual({ tier: 'LIGHT', degradedButExempt: false });
  });

  it('§6.5 — agent u DEGRADED stanju prisiljava LIGHT nezavisno od stanja provajdera', async () => {
    const { service } = makeService({ agentBudgets: [{ enforcementState: 'DEGRADED' }] });
    const result = await service.resolve({ ...baseParams, requestedTier: 'HEAVY', securityCritical: false });
    expect(result.tier).toBe('LIGHT');
  });

  it('§6.5 izuzetak — bezbednosno-kritična akcija ZADRŽAVA nivo uprkos DEGRADED stanju (jači od dva kriterijuma pobeđuje)', async () => {
    const { service } = makeService({ providerQuotas: [{ enforcementState: 'DEGRADED' }] });
    const result = await service.resolve({ ...baseParams, requestedTier: 'LIGHT', securityCritical: true });
    expect(result).toEqual({ tier: 'HEAVY', degradedButExempt: true });
  });

  it('§6.5 — normalno stanje provajdera i agenta ne utiče na traženi nivo', async () => {
    const { service } = makeService({
      providerQuotas: [{ enforcementState: 'NORMAL' }],
      agentBudgets: [{ enforcementState: 'NORMAL' }],
    });
    const result = await service.resolve({ ...baseParams, requestedTier: 'HEAVY', securityCritical: false });
    expect(result).toEqual({ tier: 'HEAVY', degradedButExempt: false });
  });
});
