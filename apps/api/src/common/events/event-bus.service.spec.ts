import { EventBusService } from './event-bus.service';

describe('EventBusService (Master dokument poglavlje 6 — Event Bus preko Postgres LISTEN/NOTIFY)', () => {
  it('poziva pg_notify preko $executeRaw sa JSON payload-om koji nosi module/event/payload', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const service = new EventBusService({ $executeRaw: executeRaw } as any);

    await service.emit('M2', 'product.published', { productId: 'p1' });

    expect(executeRaw).toHaveBeenCalledTimes(1);
    // Prisma tagged-template $executeRaw prima (strings[], ...values) — proveravamo
    // da je JSON payload prosleđen kao bind vrednost, ne ulepljen u SQL tekst.
    const values: unknown[] = (executeRaw.mock.calls[0] as unknown[]).slice(1);
    const jsonValue = values.find((v) => typeof v === 'string' && v.startsWith('{')) as string;
    expect(JSON.parse(jsonValue)).toEqual({ module: 'M2', event: 'product.published', payload: { productId: 'p1' } });
  });
});
