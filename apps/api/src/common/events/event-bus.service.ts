import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Event Bus za asinhronu komunikaciju između modula (Master dokument poglavlje 6:
 * "početno: PostgreSQL LISTEN/NOTIFY ili lagani Redis Pub/Sub"). Bira se LISTEN/NOTIFY
 * jer Postgres je jedina infrastruktura koja već postoji (docker-compose.yml) — nema
 * potrebe za novom zavisnošću (Redis) dok stvarna potreba (npr. skaliranje kroz više
 * procesa) to ne zatraži. Prvi konkretan slučaj upotrebe: M2 `product.published` (M2
 * spec §4.1), koji će M12 slušati kad taj modul bude implementiran.
 *
 * Kanal je jedan zajednički `tt_events` — svaki payload nosi (module, event) da bi
 * budući pretplatnici filtrirali sami, isti obrazac kao jedan Kafka topic sa tipom
 * poruke u payload-u umesto topic-a po tipu događaja.
 */
@Injectable()
export class EventBusService {
  private static readonly CHANNEL = 'tt_events';

  constructor(private readonly prisma: PrismaService) {}

  async emit(module: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const notifyPayload = JSON.stringify({ module, event, payload });
    // pg_notify umesto doslovnog NOTIFY <kanal>, '<payload>' — izbegava ručno eskejpovanje
    // stringa u SQL-u (payload ide kao bind parametar, ne ulepljen u tekst upita).
    await this.prisma.$executeRaw`SELECT pg_notify(${EventBusService.CHANNEL}, ${notifyPayload})`;
  }
}
