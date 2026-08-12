import { EventListenerService } from './event-listener.service';

// Mock 'pg' Client — jedinica testira samo dispatch/registraciju logiku, ne pravu konekciju.
jest.mock('pg', () => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
      on: jest.fn((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
      }),
      __triggerNotification: (payload: string) => handlers['notification']?.({ payload }),
    })),
  };
});

describe('EventListenerService (Master dokument poglavlje 6 — LISTEN strana Event Bus-a)', () => {
  async function makeService() {
    const service = new EventListenerService();
    await service.onModuleInit();
    const client = (service as any).client;
    return { service, client };
  }

  it('šalje LISTEN komandu na tt_events kanal pri pokretanju', async () => {
    const { client } = await makeService();
    expect(client.query).toHaveBeenCalledWith('LISTEN tt_events');
  });

  it('poziva registrovan handler za tačan (module, event) par', async () => {
    const { service, client } = await makeService();
    const handler = jest.fn().mockResolvedValue(undefined);
    service.on('M5', 'booking.confirmed', handler);

    client.__triggerNotification(JSON.stringify({ module: 'M5', event: 'booking.confirmed', payload: { bookingId: 'b1' } }));
    await new Promise((r) => setImmediate(r)); // dispatch je async (void poziv)

    expect(handler).toHaveBeenCalledWith({ bookingId: 'b1' });
  });

  it('ne poziva handler registrovan za drugi (module, event) par', async () => {
    const { service, client } = await makeService();
    const handler = jest.fn().mockResolvedValue(undefined);
    service.on('M5', 'booking.cancelled', handler);

    client.__triggerNotification(JSON.stringify({ module: 'M5', event: 'booking.confirmed', payload: {} }));
    await new Promise((r) => setImmediate(r));

    expect(handler).not.toHaveBeenCalled();
  });

  it('poziva sve registrovane handlere za isti događaj (više pretplatnika)', async () => {
    const { service, client } = await makeService();
    const handlerA = jest.fn().mockResolvedValue(undefined);
    const handlerB = jest.fn().mockResolvedValue(undefined);
    service.on('M5', 'booking.confirmed', handlerA);
    service.on('M5', 'booking.confirmed', handlerB);

    client.__triggerNotification(JSON.stringify({ module: 'M5', event: 'booking.confirmed', payload: {} }));
    await new Promise((r) => setImmediate(r));

    expect(handlerA).toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalled();
  });

  it('greška u jednom handleru ne sprečava pozivanje drugog (izolacija pretplatnika)', async () => {
    const { service, client } = await makeService();
    const failingHandler = jest.fn().mockRejectedValue(new Error('boom'));
    const okHandler = jest.fn().mockResolvedValue(undefined);
    service.on('M5', 'booking.confirmed', failingHandler);
    service.on('M5', 'booking.confirmed', okHandler);

    client.__triggerNotification(JSON.stringify({ module: 'M5', event: 'booking.confirmed', payload: {} }));
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(okHandler).toHaveBeenCalled();
  });

  it('ignoriše neispravan JSON payload bez pucanja procesa', async () => {
    const { client } = await makeService();
    expect(() => client.__triggerNotification('nije json')).not.toThrow();
  });

  it('onModuleDestroy zatvara konekciju', async () => {
    const { service, client } = await makeService();
    await service.onModuleDestroy();
    expect(client.end).toHaveBeenCalled();
  });
});
