import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LanguageCode } from '@prisma/client';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { ContentService } from '../content/content.service';
import { ProductsService } from '../../m2-katalog-proizvoda/products/products.service';
import { generateAiDraft, generateOfferExpiryDraft } from '../content/ai-draft-generator';
import type { OfferExpiringEventPayload } from '../../m3-ugovaranje-alotmani/pricelist/offer-expiry.service';

const DEFAULT_LANGUAGE: LanguageCode = 'sr';

/** §3d — „sutradan u 9:00 lokalno" (vreme servera; agencija radi u jednoj vremenskoj zoni). */
export function tomorrowAtNine(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * M12 spec §3, koraci 1-2 — "kad Product.status u M2 pređe u ACTIVE, M2 emituje product.published
 * ... M12 se pretplaćuje ... AI agent automatski priprema nacrt (status=PENDING_APPROVAL,
 * generated_by=AI)". Isti obrazac kao M13EventSubscribersService (LISTEN/NOTIFY preko
 * EventListenerService), ne prava LLM integracija — vidi ai-draft-generator.ts.
 */
@Injectable()
export class M12EventSubscribersService implements OnModuleInit {
  private readonly logger = new Logger(M12EventSubscribersService.name);

  constructor(
    private readonly eventListener: EventListenerService,
    private readonly content: ContentService,
    private readonly products: ProductsService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M2', 'product.published', async (payload) => {
      await this.handleProductPublished(payload.productId as string);
    });
    // §3d — drugi okidač: M3 akcija pred istek (7 dana do roka, M3 §4.9).
    this.eventListener.on('M3', 'pricelist.offer.expiring', async (payload) => {
      await this.handleOfferExpiring(payload as OfferExpiringEventPayload);
    });
  }

  /**
   * §3d — jedan događaj → jedan nacrt, tri kanala (`FACEBOOK`, `INSTAGRAM`, `B2B_SUBAGENTS`;
   * `EMAIL` gostima namerno NE), rok kao datum u tekstu, `scheduled_publish_at` sutra u 9:00.
   * Sve iz događaja, bez čitanja M3 baze. Bez proizvoda u M2 nacrt nema smisla (nema šta da se
   * objavi ni na šta da subagent klikne) — M3 ionako ne emituje bez objavljenog proizvoda.
   */
  async handleOfferExpiring(ev: OfferExpiringEventPayload): Promise<void> {
    try {
      if (!ev.product_id) {
        this.logger.warn(`Akcija ${ev.source_id} bez proizvoda u M2 — nacrt preskočen.`);
        return;
      }
      const live = await this.content.findLiveDraftForOffer(ev.source_id);
      if (live) {
        this.logger.log(
          `Akcija ${ev.source_id} već ima živ nacrt ${live.id} (${live.status}) — ponovljen događaj ignorisan.`,
        );
        return;
      }
      const draft = generateOfferExpiryDraft({
        productName: ev.product_name,
        destinationCity: ev.destination_city,
        destinationCountry: ev.destination_country,
        offerKind: ev.offer_kind,
        discountSummary: ev.discount_summary,
        bookingTo: ev.booking_to,
        stayFrom: ev.stay_from,
        stayTo: ev.stay_to,
      });
      await this.content.createAiDraft({
        productId: ev.product_id,
        title: draft.title,
        body: draft.body,
        languageCode: DEFAULT_LANGUAGE,
        targetChannels: ['FACEBOOK', 'INSTAGRAM', 'B2B_SUBAGENTS'],
        trigger: 'pricelist.offer.expiring',
        offerBookingTo: new Date(ev.booking_to),
        sourceOfferId: ev.source_id,
        // M7 §5b.1 — podrazumevan krug po tome da li proizvod ima dodele; čovek menja klikom.
        b2bAudience: ev.has_subagent_allocations ? 'ASSIGNED_ONLY' : 'ALL_ACTIVE',
        scheduledPublishAt: tomorrowAtNine(),
      });
    } catch (err) {
      this.logger.error(
        `Neuspešno kreiranje nacrta za akciju pred istek ${ev.source_id}: ${(err as Error).message}`,
      );
    }
  }

  private async handleProductPublished(productId: string): Promise<void> {
    try {
      const product = await this.products.findOne(productId, DEFAULT_LANGUAGE);
      if (!product.translation) {
        this.logger.warn(
          `Proizvod ${productId} objavljen bez prevoda za ${DEFAULT_LANGUAGE} — AI nacrt sadržaja preskočen (nema izvornog teksta).`,
        );
        return;
      }
      const draft = generateAiDraft({
        productName: product.translation.name,
        productDescription: product.translation.description,
        destinationCity: product.destinationCity,
        destinationCountry: product.destinationCountry,
      });
      await this.content.createAiDraft({
        productId,
        title: draft.title,
        body: draft.body,
        languageCode: product.translation.languageCode,
      });
    } catch (err) {
      // Isti princip kao EventListenerService.dispatch — jedan neuspešan handler ne sme
      // srušiti proces niti blokirati druge pretplatnike istog događaja.
      this.logger.error(
        `Neuspešno kreiranje AI nacrta za proizvod ${productId}: ${(err as Error).message}`,
      );
    }
  }
}
