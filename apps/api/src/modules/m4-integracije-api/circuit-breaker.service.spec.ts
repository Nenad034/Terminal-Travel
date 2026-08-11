import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService (M4 spec §4.1)', () => {
  function makeService() {
    const prisma = { providerConfig: { update: jest.fn(), findUniqueOrThrow: jest.fn() } };
    const eventBus = { emit: jest.fn() };
    const service = new CircuitBreakerService(prisma as any, eventBus as any);
    return { service, prisma, eventBus };
  }

  describe('canCall', () => {
    it('CLOSED uvek dozvoljava poziv', async () => {
      const { service } = makeService();
      const result = await service.canCall({ circuitState: 'CLOSED' } as any);
      expect(result).toEqual({ allowed: true, effectiveState: 'CLOSED' });
    });

    it('OPEN pre isteka cooldown-a odbija poziv', async () => {
      const { service } = makeService();
      const result = await service.canCall({
        circuitState: 'OPEN',
        circuitOpenedAt: new Date(),
        circuitCooldownSeconds: 60,
      } as any);
      expect(result).toEqual({ allowed: false, effectiveState: 'OPEN' });
    });

    it('OPEN posle isteka cooldown-a prelazi u HALF_OPEN i dozvoljava probni poziv', async () => {
      const { service, prisma } = makeService();
      const result = await service.canCall({
        providerCode: 'travelgate',
        circuitState: 'OPEN',
        circuitOpenedAt: new Date(Date.now() - 120_000),
        circuitCooldownSeconds: 60,
      } as any);

      expect(result).toEqual({ allowed: true, effectiveState: 'HALF_OPEN' });
      expect(prisma.providerConfig.update).toHaveBeenCalledWith({
        where: { providerCode: 'travelgate' },
        data: { circuitState: 'HALF_OPEN' },
      });
    });

    it('HALF_OPEN dozvoljava poziv (probni)', async () => {
      const { service } = makeService();
      const result = await service.canCall({ circuitState: 'HALF_OPEN' } as any);
      expect(result).toEqual({ allowed: true, effectiveState: 'HALF_OPEN' });
    });
  });

  describe('recordSuccess', () => {
    it('vraća kolo u CLOSED i resetuje brojač grešaka', async () => {
      const { service, prisma } = makeService();
      await service.recordSuccess('travelgate');
      expect(prisma.providerConfig.update).toHaveBeenCalledWith({
        where: { providerCode: 'travelgate' },
        data: { circuitState: 'CLOSED', circuitConsecutiveFailures: 0, circuitOpenedAt: null },
      });
    });
  });

  describe('recordFailure', () => {
    it('CLOSED sa greškama ispod praga samo uvećava brojač, ostaje CLOSED', async () => {
      const { service, prisma } = makeService();
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({
        providerCode: 'travelgate',
        circuitState: 'CLOSED',
        circuitConsecutiveFailures: 2,
        circuitFailureThreshold: 5,
        circuitOpenedAt: null,
      });

      await service.recordFailure('travelgate');

      expect(prisma.providerConfig.update).toHaveBeenCalledWith({
        where: { providerCode: 'travelgate' },
        data: { circuitConsecutiveFailures: 3, circuitState: 'CLOSED', circuitOpenedAt: null },
      });
    });

    it('CLOSED sa greškama koje dostignu prag prelazi u OPEN i emituje provider_error_spike', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({
        providerCode: 'travelgate',
        circuitState: 'CLOSED',
        circuitConsecutiveFailures: 4,
        circuitFailureThreshold: 5,
        circuitOpenedAt: null,
      });

      await service.recordFailure('travelgate');

      const call = prisma.providerConfig.update.mock.calls[0][0];
      expect(call.data.circuitState).toBe('OPEN');
      expect(call.data.circuitConsecutiveFailures).toBe(5);
      expect(call.data.circuitOpenedAt).toBeInstanceOf(Date);
      expect(eventBus.emit).toHaveBeenCalledWith('M4', 'provider_error_spike', { providerCode: 'travelgate' });
    });

    it('HALF_OPEN probni poziv koji ne uspe odmah vraća u OPEN, bez čekanja na prag', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({
        providerCode: 'travelgate',
        circuitState: 'HALF_OPEN',
        circuitConsecutiveFailures: 0,
        circuitFailureThreshold: 5,
        circuitOpenedAt: null,
      });

      await service.recordFailure('travelgate');

      const call = prisma.providerConfig.update.mock.calls[0][0];
      expect(call.data.circuitState).toBe('OPEN');
      expect(call.data.circuitConsecutiveFailures).toBe(5);
      expect(eventBus.emit).toHaveBeenCalledWith('M4', 'provider_error_spike', { providerCode: 'travelgate' });
    });
  });
});
