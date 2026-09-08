import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SearchLogEntry {
  channel: string;
  actorId?: string;
  clientAccountId?: string;
  productType?: string;
  destinationCountry?: string;
  destinationCity?: string;
  resultCount: number;
}

// M5 spec §3.0i — jedan zapis po GET /search pozivu, radi M13 §4.4 ("Vremenski obrasci").
// Namerno bez IP-a/kolačić-identifikatora (vlasnikova odluka) — actorId/clientAccountId
// ostaju undefined za anonimne pozive.
@Injectable()
export class SearchLogService {
  private readonly logger = new Logger(SearchLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // "Fire and forget" — kvar upisa loga ne sme srušiti pretragu (§3.0i.2).
  log(entry: SearchLogEntry): void {
    this.prisma.searchLog
      .create({
        data: {
          channel: entry.channel,
          actorId: entry.actorId,
          clientAccountId: entry.clientAccountId,
          productType: entry.productType,
          destinationCountry: entry.destinationCountry,
          destinationCity: entry.destinationCity,
          resultCount: entry.resultCount,
        },
      })
      .catch((err) => this.logger.warn(`SearchLog upis nije uspeo: ${err}`));
  }
}
