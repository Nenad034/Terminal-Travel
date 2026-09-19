import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SearchLogEntry {
  channel: string;
  actorId?: string;
  clientAccountId?: string;
  productType?: string;
  destinationCountry?: string;
  destinationCity?: string;
  resultCount: number;
  // M5 spec §3.0k.1 — koliko unapred i za koga.
  stayFrom?: string;
  stayTo?: string;
  adults?: number;
  children?: number;
  amenityTags?: string[];
}

// M5 spec §3.0k.2 — jedan red po PRIKAZANOM rezultatu (najviše prvih MAX_RESULTS_LOGGED).
export interface SearchLogResultEntry {
  productId: string;
  sourceType: string;
  offerFinalPrice: number;
  offerBaseCost: number | null;
  currency: string;
  markupRuleId: string | null;
  availabilityStatus: string;
  remainingUnits: number | null;
  isRefundable: boolean | null;
}

/** §3.0k.2 — vlasnikova odluka 19.9.2026: prvih 20 (prvi ekran), ostatak je šum. */
export const MAX_RESULTS_LOGGED = 20;

const DAN_MS = 86_400_000;

/** `stay_from − danas` u danima; `null` kad datum nedostaje ili nije čitljiv. */
export function leadTimeDays(stayFrom: string | undefined, today: Date): number | null {
  if (!stayFrom) return null;
  const d = new Date(stayFrom);
  if (Number.isNaN(d.getTime())) return null;
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((d.getTime() - t) / DAN_MS);
}

/** Broj noći; `null` kad bilo koji datum nedostaje ili je opseg neispravan. */
export function nightsBetween(stayFrom?: string, stayTo?: string): number | null {
  if (!stayFrom || !stayTo) return null;
  const a = new Date(stayFrom).getTime();
  const b = new Date(stayTo).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / DAN_MS);
}

// M5 spec §3.0i — jedan zapis po GET /search pozivu, radi M13 §4.4 ("Vremenski obrasci").
// Namerno bez IP-a/kolačić-identifikatora (vlasnikova odluka) — actorId/clientAccountId
// ostaju undefined za anonimne pozive. §3.0k (19.9.2026) dodaje boravak/lead-time/goste i
// prikazane rezultate; sve i dalje bez ličnog podatka.
@Injectable()
export class SearchLogService {
  private readonly logger = new Logger(SearchLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * "Fire and forget" — kvar upisa loga ne sme srušiti pretragu (§3.0i.2). Vraća id ODMAH
   * (generisan u kodu, ne čeka bazu) da ga kontroler pošalje kao `X-Search-Id` (§3.0k.3) —
   * klijent ga prosleđuje u `POST /quotes` i tako spaja upit sa ponudom.
   */
  log(entry: SearchLogEntry, results: SearchLogResultEntry[] = [], now = new Date()): string {
    const id = randomUUID();
    const prikazani = results.slice(0, MAX_RESULTS_LOGGED);
    this.prisma.searchLog
      .create({
        data: {
          id,
          channel: entry.channel,
          actorId: entry.actorId,
          clientAccountId: entry.clientAccountId,
          productType: entry.productType,
          destinationCountry: entry.destinationCountry,
          destinationCity: entry.destinationCity,
          resultCount: entry.resultCount,
          stayFrom: entry.stayFrom ? new Date(entry.stayFrom) : null,
          stayTo: entry.stayTo ? new Date(entry.stayTo) : null,
          leadTimeDays: leadTimeDays(entry.stayFrom, now),
          nights: nightsBetween(entry.stayFrom, entry.stayTo),
          adults: entry.adults ?? null,
          children: entry.children ?? null,
          amenityTags: entry.amenityTags ?? [],
          results: prikazani.length
            ? { create: prikazani.map((r, i) => ({ rank: i + 1, ...r })) }
            : undefined,
        },
      })
      .catch((err) => this.logger.warn(`SearchLog upis nije uspeo: ${err}`));
    return id;
  }
}
