import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LanguageCode } from '@prisma/client';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { ContentService } from '../content/content.service';
import { ProductsService } from '../../m2-katalog-proizvoda/products/products.service';
import { generateAiDraft } from '../content/ai-draft-generator';

const DEFAULT_LANGUAGE: LanguageCode = 'sr';

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
      this.logger.error(`Neuspešno kreiranje AI nacrta za proizvod ${productId}: ${(err as Error).message}`);
    }
  }
}
