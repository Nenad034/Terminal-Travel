import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';

type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * "Čitalačka" strana Event Bus-a (Master dokument poglavlje 6 — Postgres LISTEN/NOTIFY).
 * `EventBusService` (isti folder) samo šalje (`NOTIFY`); ovo je prva stvarna upotreba
 * LISTEN strane — M10 je prvi modul koji se pretplaćuje na tuđi događaj (M5
 * `booking.confirmed`) umesto da samo emituje sopstvene.
 *
 * Zahteva trajnu, posvećenu konekciju (`pg` Client, ne Prisma-in pool — Prisma nema
 * podršku za LISTEN/NOTIFY) koja ostaje otvorena za vreme celog života procesa.
 *
 * Ta trajna konekcija je i razlog za mehanizam ponovnog povezivanja ispod (dodat 6.9.2026,
 * vidi zamku 14.1 u `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`): svaki prekid veze ka
 * bazi — restart Postgres kontejnera na razvojnoj mašini, prekid mreže ili `pg_terminate_backend`
 * na serveru — inače obara CEO API proces, jer `pg` grešku prijavljuje na konekciji koju niko
 * ne prati. Šest modula (M10, M11, M12, M13, M18, M19) visi o ovom servisu, pa pad ovde nije
 * kvar jedne pretplate nego prekid rada cele aplikacije.
 *
 * Svesno ograničenje: Postgres LISTEN/NOTIFY ne pamti poruke. Događaji objavljeni DOK je veza
 * prekinuta su nepovratno izgubljeni — ponovno povezivanje vraća isporuku ubuduće, ne unazad.
 * Zato se na ovaj kanal i dalje ne sme oslanjati ništa što mora da se desi tačno jednom
 * (novac, fiskalne obaveze); za takve slučajeve pretplatnik mora imati sopstvenu proveru
 * zaostatka. Isto je važilo i pre ove izmene — dotad je posledica bila pad procesa umesto
 * tihog gubitka poruke.
 */
@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private static readonly CHANNEL = 'tt_events';
  /** Čekanje pre prvog ponovnog pokušaja; udvostručuje se do gornje granice. */
  private static readonly INITIAL_RETRY_MS = 1_000;
  private static readonly MAX_RETRY_MS = 30_000;

  private readonly logger = new Logger(EventListenerService.name);
  private client: Client | null = null;
  private readonly handlers = new Map<string, EventHandler[]>();
  private retryDelayMs = EventListenerService.INITIAL_RETRY_MS;
  private retryTimer: NodeJS.Timeout | null = null;
  /** Postavlja se u onModuleDestroy — sprečava da zakazan pokušaj oživi ugašen servis. */
  private stopped = false;

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const client = this.client;
    this.client = null;
    try {
      await client?.end();
    } catch (err) {
      // Gašenje aplikacije ne sme da padne zato što je veza već mrtva.
      this.logger.warn(`Zatvaranje event listener konekcije: ${(err as Error).message}`);
    }
  }

  /** Registruje handler za (module, event) par — npr. on('M5', 'booking.confirmed', ...). */
  on(module: string, event: string, handler: EventHandler): void {
    const key = `${module}.${event}`;
    const existing = this.handlers.get(key) ?? [];
    existing.push(handler);
    this.handlers.set(key, existing);
  }

  /**
   * Otvara konekciju i pretplaćuje se na kanal. Nikad ne baca — neuspeh zakazuje nov pokušaj,
   * jer bi bačena greška iz `onModuleInit` sprečila podizanje celog API-ja (a baza koja se
   * podiže sporije od aplikacije je uobičajeno stanje, ne kvar).
   */
  private async connect(): Promise<void> {
    if (this.stopped) return;

    const client = new Client({ connectionString: process.env.DATABASE_URL });

    // Slušalac greške se kači PRE `connect()`: `pg` prijavljuje prekid veze kao 'error'
    // događaj na klijentu, a događaj bez slušaoca u Node-u obara proces. Ranije je ovaj
    // red stajao POSLE `connect()`/`query()`, pa je prozor u kom je konekcija nezaštićena
    // bio upravo onaj u kom prekid i nastaje.
    client.on('error', (err) => {
      this.logger.error(`Event listener konekcija je prijavila grešku: ${err.message}`);
      this.scheduleReconnect(client);
    });
    client.on('end', () => {
      this.scheduleReconnect(client);
    });
    client.on('notification', (msg) => {
      void this.dispatch(msg.payload);
    });

    this.client = client;

    try {
      await client.connect();
      await client.query(`LISTEN ${EventListenerService.CHANNEL}`);
      this.retryDelayMs = EventListenerService.INITIAL_RETRY_MS;
      this.logger.log(`Event listener sluša kanal ${EventListenerService.CHANNEL}.`);
    } catch (err) {
      this.logger.error(`Event listener ne može da se poveže na bazu: ${(err as Error).message}`);
      this.scheduleReconnect(client);
    }
  }

  /**
   * Zakazuje nov pokušaj sa udvostručavanjem čekanja. Prima konekciju koja je otkazala da bi
   * se odbacili pozivi sa STARE konekcije: i 'error' i 'end' umeju da se jave za isti prekid,
   * a i zamenjena konekcija se javi kad se zatvori — bez ove provere jedan prekid bi pokrenuo
   * više paralelnih lanaca povezivanja.
   */
  private scheduleReconnect(failed: Client): void {
    if (this.stopped) return;
    if (this.client !== failed) return;
    if (this.retryTimer) return;

    this.client = null;
    void failed.end().catch(() => undefined);

    const delay = this.retryDelayMs;
    this.logger.warn(`Ponovno povezivanje event listener-a za ${Math.round(delay / 1000)}s.`);
    this.retryDelayMs = Math.min(delay * 2, EventListenerService.MAX_RETRY_MS);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
    // Tajmer ne sme da drži proces u životu kad se aplikacija gasi.
    this.retryTimer.unref?.();
  }

  private async dispatch(rawPayload: string | undefined): Promise<void> {
    if (!rawPayload) return;
    let parsed: { module: string; event: string; payload: Record<string, unknown> };
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      this.logger.error(`Neispravan JSON u NOTIFY payload-u: ${rawPayload}`);
      return;
    }

    const key = `${parsed.module}.${parsed.event}`;
    const handlers = this.handlers.get(key) ?? [];
    for (const handler of handlers) {
      try {
        await handler(parsed.payload);
      } catch (err) {
        // Jedan neuspešan handler ne sme oboriti proces niti blokirati ostale
        // pretplatnike istog događaja — greška se loguje, obrada nastavlja.
        this.logger.error(`Handler za ${key} je bacio grešku: ${(err as Error).message}`);
      }
    }
  }
}
