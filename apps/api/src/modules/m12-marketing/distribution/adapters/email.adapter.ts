import { Logger } from '@nestjs/common';
import {
  DistributionChannelAdapter,
  NormalizedContentPiece,
  PublishResult,
} from '../distribution-channel-adapter.interface';

/**
 * M12 spec §4 — EMAIL kanal. Ovaj adapter je isključivo transportni sloj (mock/stub, isti
 * nivo apstrakcije kao M4 MockProviderAdapter) — "šalje" tako što loguje/beleži, ne stvarnom
 * SMTP integracijom (potvrđeno da ne postoji nodemailer/EmailService u bazi koda). Stvarna
 * poslovna logika (marketing_consent=true provera + target_tags presek) NIJE ovde — nalazi se
 * u DistributionService.resolveEmailRecipients (preko M6 ClientAccountsService.findMarketingRecipients),
 * jer to je testibilan poslovni deo koji ne sme zavisiti od transportnog sloja.
 */
export class EmailMockAdapter implements DistributionChannelAdapter {
  private readonly logger = new Logger(EmailMockAdapter.name);
  public readonly channelCode = 'EMAIL';

  /** Postavlja DistributionService pre poziva publish() — spisak već filtriranih primalaca. */
  recipients: { id: string; email: string }[] = [];

  async publish(content: NormalizedContentPiece): Promise<PublishResult> {
    this.logger.log(
      `[mock] Slanje EMAIL newslettera "${content.title}" (ContentPiece ${content.contentPieceId}) na ${this.recipients.length} primalaca sa marketing_consent=true.`,
    );
    for (const recipient of this.recipients) {
      this.logger.log(`[mock]   -> ${recipient.email}`);
    }
    return { externalPostId: `MOCK-EMAIL-${content.contentPieceId}`, publishedAt: new Date().toISOString() };
  }

  async unpublish(externalPostId: string): Promise<void> {
    this.logger.log(`[mock] EMAIL "objava" ${externalPostId} nema pojam unpublish (već poslati mejlovi) — no-op.`);
  }
}
