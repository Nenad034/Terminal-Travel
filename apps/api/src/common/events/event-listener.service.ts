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
 */
@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private static readonly CHANNEL = 'tt_events';
  private readonly logger = new Logger(EventListenerService.name);
  private client: Client | null = null;
  private readonly handlers = new Map<string, EventHandler[]>();

  async onModuleInit(): Promise<void> {
    this.client = new Client({ connectionString: process.env.DATABASE_URL });
    await this.client.connect();
    await this.client.query(`LISTEN ${EventListenerService.CHANNEL}`);
    this.client.on('notification', (msg) => {
      void this.dispatch(msg.payload);
    });
    this.client.on('error', (err) => {
      this.logger.error(`Event listener konekcija je prijavila grešku: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.end();
  }

  /** Registruje handler za (module, event) par — npr. on('M5', 'booking.confirmed', ...). */
  on(module: string, event: string, handler: EventHandler): void {
    const key = `${module}.${event}`;
    const existing = this.handlers.get(key) ?? [];
    existing.push(handler);
    this.handlers.set(key, existing);
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
