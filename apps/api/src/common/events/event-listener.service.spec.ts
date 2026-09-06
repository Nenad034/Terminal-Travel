import { EventListenerService } from './event-listener.service';

// Mock 'pg' Client — jedinica testira dispatch/registraciju i ponovno povezivanje, ne pravu
// konekciju. Svaka instanca ima SOPSTVENU mapu slušalaca (bitno za testove ponovnog
// povezivanja: tamo postoje dve konekcije, stara otkazana i nova).
const madeClients: any[] = [];
let connectBehavior: () => Promise<void> = async () => undefined;

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const client: any = {
      connect: jest.fn(() => connectBehavior()),
      query: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
      on: jest.fn((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
        // Redosled kačenja je bitan (zamka 14.1): slušalac greške mora biti postavljen
        // PRE connect(), inače prekid u toku povezivanja obara ceo proces.
        client.__onCalledBeforeConnect[event] = client.connect.mock.calls.length === 0;
      }),
      __onCalledBeforeConnect: {} as Record<string, boolean>,
      __trigger: (event: string, arg?: unknown) => handlers[event]?.(arg),
      __triggerNotification: (payload: string) => handlers['notification']?.({ payload }),
    };
    madeClients.push(client);
    return client;
  }),
}));

describe('EventListenerService (Master dokument poglavlje 6 — LISTEN strana Event Bus-a)', () => {
  beforeEach(() => {
    madeClients.length = 0;
    connectBehavior = async () => undefined;
  });

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

  // --- Ponovno povezivanje (6.9.2026, zamka 14.1) ---
  // Prekid veze ka bazi je ranije obarao CEO API proces; ovi testovi čuvaju ispravku.
  describe('otpornost na prekid veze ka bazi', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('kači slušalac greške PRE connect() — konekcija nijedan trenutak nije nezaštićena', async () => {
      const { client } = await makeService();
      expect(client.__onCalledBeforeConnect.error).toBe(true);
    });

    it('ne baca kad baza nije dostupna pri pokretanju (API se digne i bez baze)', async () => {
      connectBehavior = async () => {
        throw new Error('Connection terminated unexpectedly');
      };
      const service = new EventListenerService();

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      await service.onModuleDestroy();
    });

    it('ponovo se povezuje i ponovo šalje LISTEN posle neuspelog povezivanja', async () => {
      let attempts = 0;
      connectBehavior = async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('Connection terminated unexpectedly');
      };
      const service = new EventListenerService();
      await service.onModuleInit();
      expect(madeClients).toHaveLength(1);

      await jest.advanceTimersByTimeAsync(1_000);

      expect(madeClients).toHaveLength(2);
      expect(madeClients[1].query).toHaveBeenCalledWith('LISTEN tt_events');
      await service.onModuleDestroy();
    });

    it('ponovo se povezuje kad veza pukne u radu (pg prijavi grešku na konekciji)', async () => {
      const { service, client } = await makeService();

      client.__trigger('error', new Error('Connection terminated unexpectedly'));
      await jest.advanceTimersByTimeAsync(1_000);

      expect(madeClients).toHaveLength(2);
      expect(madeClients[1].query).toHaveBeenCalledWith('LISTEN tt_events');
      await service.onModuleDestroy();
    });

    it('pretplate preživljavaju ponovno povezivanje (handler radi i na novoj konekciji)', async () => {
      const { service, client } = await makeService();
      const handler = jest.fn().mockResolvedValue(undefined);
      service.on('M5', 'booking.confirmed', handler);

      client.__trigger('error', new Error('pukla veza'));
      await jest.advanceTimersByTimeAsync(1_000);

      madeClients[1].__triggerNotification(
        JSON.stringify({ module: 'M5', event: 'booking.confirmed', payload: { bookingId: 'b2' } }),
      );
      await Promise.resolve();

      expect(handler).toHaveBeenCalledWith({ bookingId: 'b2' });
      await service.onModuleDestroy();
    });

    it('jedan prekid pravi jedan pokušaj — greška i zatvaranje iste konekcije se ne udvajaju', async () => {
      const { service, client } = await makeService();

      client.__trigger('error', new Error('pukla veza'));
      client.__trigger('end');
      await jest.advanceTimersByTimeAsync(1_000);

      expect(madeClients).toHaveLength(2);
      await service.onModuleDestroy();
    });

    it('produžava čekanje između uzastopnih neuspeha (1s, pa 2s) umesto vrtenja u krug', async () => {
      connectBehavior = async () => {
        throw new Error('baza i dalje nije tu');
      };
      const service = new EventListenerService();
      await service.onModuleInit();

      await jest.advanceTimersByTimeAsync(1_000);
      expect(madeClients).toHaveLength(2);

      await jest.advanceTimersByTimeAsync(1_000); // prerano za treći pokušaj
      expect(madeClients).toHaveLength(2);

      await jest.advanceTimersByTimeAsync(1_000); // ukupno 2s od drugog neuspeha
      expect(madeClients).toHaveLength(3);

      await service.onModuleDestroy();
    });

    it('posle gašenja servisa ne pokušava ponovno povezivanje', async () => {
      const { service, client } = await makeService();
      await service.onModuleDestroy();

      client.__trigger('error', new Error('pukla veza posle gašenja'));
      await jest.advanceTimersByTimeAsync(60_000);

      expect(madeClients).toHaveLength(1);
    });
  });
});
