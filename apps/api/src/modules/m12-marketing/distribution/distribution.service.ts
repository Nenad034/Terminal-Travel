import { Injectable, Logger } from '@nestjs/common';
import { ContentPiece, ContentTranslation, LanguageCode } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ClientAccountsService } from '../../m6-crm/client-accounts/client-accounts.service';
import { SubagentNoticesService } from '../../m7-b2b-subagenti/subagents/subagent-notices.service';
import { SuppliersService } from '../../m3-ugovaranje-alotmani/suppliers/suppliers.service';
import { MailerService } from '../../../common/mail/mailer.service';
import { SocialMockAdapter } from './adapters/social-mock.adapter';
import { EmailMockAdapter } from './adapters/email.adapter';
import { MobilePushStubAdapter } from './adapters/mobile-push.adapter';
import { B2bSubagentsAdapter } from './adapters/b2b-subagents.adapter';
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
  private readonly b2bAdapter = new B2bSubagentsAdapter();

  constructor(
    private readonly clientAccounts: ClientAccountsService,
    private readonly subagentNotices: SubagentNoticesService,
    private readonly suppliers: SuppliersService,
    private readonly mailer: MailerService,
  ) {}

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
        case 'B2B_SUBAGENTS':
          await this.publishB2bSubagents(content);
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
    const targetTags = Array.isArray(content.targetTags)
      ? (content.targetTags as unknown[]).map(String)
      : null;
    const recipients = await this.clientAccounts.findMarketingRecipients(targetTags);
    this.emailAdapter.recipients = recipients
      .filter((r) => !!r.email)
      .map((r) => ({ id: r.id, email: r.email as string }));
    await this.emailAdapter.publish(this.toNormalized(content));
  }

  /**
   * M12 spec §4 / M7 §5b — `B2B_SUBAGENTS`: (1) ograda nad tekstom (ime dobavljača, nabavna
   * cena, broj jedinica — §5b.3), (2) primaoci iz M7 po `b2b_audience` (§5b.1), (3) red na
   * portalu za svakog (`SubagentNotice`), (4) mejl onima koji ga nisu isključili — poslovna
   * komunikacija sa partnerom (`TRANSACTIONAL`), ne prolazi `marketing_consent` (§5b.2).
   * Mejl koji ne prođe ne obara objavu: portal je primarni kanal, mejl je kopija.
   */
  private async publishB2bSubagents(content: PublishableContent): Promise<void> {
    if (!content.productId) {
      throw new BadRequestException(
        'B2B_SUBAGENTS kanal traži sadržaj vezan za proizvod — subagent mora imati na šta da klikne (M7 §5b.2).',
      );
    }
    const normalized = this.toNormalized(content);
    const supplierPage = await this.suppliers.findAll({ page: 1, limit: 200 });
    this.b2bAdapter.forbiddenSupplierNames = supplierPage.data.map((s) => s.name);
    const reason = this.b2bAdapter.forbiddenContentReason(normalized);
    if (reason) {
      throw new BadRequestException(
        `Objava na B2B_SUBAGENTS odbijena: ${reason} (M7 §5b.3 — subagent nikad ne vidi nabavnu cenu, dobavljača ni broj jedinica).`,
      );
    }
    await this.b2bAdapter.publish(normalized);

    const audience = content.b2bAudience ?? 'ALL_ACTIVE';
    const recipients = await this.subagentNotices.findRecipients(content.productId, audience);
    const rokTekst = content.offerBookingTo
      ? ` (rezervacije do ${content.offerBookingTo.toISOString().slice(0, 10).split('-').reverse().join('.')}.)`
      : '';
    const deliveries: { subagentId: string; emailedAt: Date | null }[] = [];
    for (const r of recipients) {
      let emailedAt: Date | null = null;
      if (r.offerNoticesByEmail && r.email) {
        const sent = await this.mailer.send({
          to: r.email,
          subject: `${normalized.title}${rokTekst}`,
          text:
            `${normalized.body}

` +
            `Ovo obaveštenje je poslato partnerskoj agenciji ${r.name} kao ugovornom partneru. ` +
            'Uslove i svoju cenu vidite na B2B portalu.',
        });
        if (sent.delivered) emailedAt = new Date();
        else
          this.logger.warn(
            `B2B_SUBAGENTS: mejl subagentu ${r.subagentId} nije otišao (${sent.error ?? 'bez razloga'}) — portal obaveštenje ostaje.`,
          );
      }
      deliveries.push({ subagentId: r.subagentId, emailedAt });
    }
    const created = await this.subagentNotices.deliver(content.id, deliveries);
    this.logger.log(
      `B2B_SUBAGENTS: sadržaj ${content.id} → ${recipients.length} primalaca (${audience}), ${created} novih obaveštenja na portalu, ${deliveries.filter((d) => d.emailedAt).length} mejlova.`,
    );
  }
}
