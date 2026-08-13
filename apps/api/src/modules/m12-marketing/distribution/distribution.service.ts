import { Injectable, Logger } from '@nestjs/common';
import { ContentPiece, ContentTranslation, LanguageCode } from '@prisma/client';
import { ClientAccountsService } from '../../m6-crm/client-accounts/client-accounts.service';
import { SocialMockAdapter } from './adapters/social-mock.adapter';
import { EmailMockAdapter } from './adapters/email.adapter';
import { MobilePushStubAdapter } from './adapters/mobile-push.adapter';
import { NormalizedContentPiece } from './distribution-channel-adapter.interface';

const DEFAULT_LANGUAGE: LanguageCode = 'sr';

function resolvePrimaryTranslation(translations: ContentTranslation[]): ContentTranslation | null {
  const byLang = (lang: LanguageCode) => translations.find((t) => t.languageCode === lang) ?? null;
  return byLang(DEFAULT_LANGUAGE) ?? byLang('en') ?? translations[0] ?? null;
}

type PublishableContent = ContentPiece & { translations: ContentTranslation[] };

/**
 * M12 spec §4 — orkestrira objavu preko target_channels. `M8_SITE` nema sopstveni adapter
 * ("sadržaj se jednostavno čita direktno iz ContentPiece/ContentTranslation preko M2-stil
 * API-ja") — objava na tom kanalu je već završena samim postojanjem PUBLISHED zapisa koji
 * ContentController.findAll/findOne/findBySlug servira, zato nema poziva ka adapteru za njega.
 */
@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);
  private readonly facebookAdapter = new SocialMockAdapter('FACEBOOK');
  private readonly instagramAdapter = new SocialMockAdapter('INSTAGRAM');
  private readonly emailAdapter = new EmailMockAdapter();
  private readonly mobilePushAdapter = new MobilePushStubAdapter();

  constructor(private readonly clientAccounts: ClientAccountsService) {}

  private toNormalized(content: PublishableContent): NormalizedContentPiece {
    const translation = resolvePrimaryTranslation(content.translations);
    return {
      contentPieceId: content.id,
      type: content.type,
      title: translation?.title ?? '(bez naslova)',
      body: translation?.body ?? '',
      languageCode: translation?.languageCode ?? DEFAULT_LANGUAGE,
      trackingCode: content.trackingCode,
      slug: content.slug,
      // §3a — ?ref=<tracking_code> link ka M8 sajtu. M8 frontend rute (§3b, /stranica/:slug,
      // /blog/:slug, i hvatanje ?ref=) namerno nisu implementirane (M8 je pauziran — CLAUDE.md
      // "NE DIRAJ apps/web/") — ostaje null dok taj modul ne dobije kod, isti princip kao
      // MobilePushStubAdapter čeka M9.
      linkUrl: null,
      containsAiGeneratedMedia: content.containsAiGeneratedMedia,
    };
  }

  async publish(content: PublishableContent): Promise<void> {
    for (const channel of content.targetChannels) {
      switch (channel) {
        case 'M8_SITE':
          // Nema adaptera (§4) — sadržaj je već dostupan preko GET /content čim je PUBLISHED.
          break;
        case 'FACEBOOK':
          await this.facebookAdapter.publish(this.toNormalized(content));
          break;
        case 'INSTAGRAM':
          await this.instagramAdapter.publish(this.toNormalized(content));
          break;
        case 'EMAIL':
          await this.publishEmail(content);
          break;
        case 'MOBILE_PUSH':
          await this.mobilePushAdapter.publish(this.toNormalized(content));
          break;
        default:
          this.logger.warn(`Nepoznat distribucioni kanal: ${channel}`);
      }
    }
  }

  // M12 spec §4 — "EMAIL kanal šalje samo ClientAccount zapisima sa marketing_consent=true
  // ... ako je target_tags popunjeno, skup primalaca se dodatno filtrira ... čisto sužavanje,
  // nikad proširenje". findMarketingRecipients (M6 ClientAccountsService) sprovodi tačno to.
  private async publishEmail(content: PublishableContent): Promise<void> {
    const targetTags = Array.isArray(content.targetTags) ? (content.targetTags as unknown[]).map(String) : null;
    const recipients = await this.clientAccounts.findMarketingRecipients(targetTags);
    this.emailAdapter.recipients = recipients
      .filter((r) => !!r.email)
      .map((r) => ({ id: r.id, email: r.email as string }));
    await this.emailAdapter.publish(this.toNormalized(content));
  }
}
