import { Logger } from '@nestjs/common';
import {
  DistributionChannelAdapter,
  NormalizedContentPiece,
  PublishResult,
} from '../distribution-channel-adapter.interface';

/**
 * M12 spec §4 / M7 §5b — `B2B_SUBAGENTS` kanal. Ne ide na spoljnu platformu: obaveštenje na
 * B2B portalu (M7 `SubagentNotice`) + mejl kroz zajednički `MailerService`. Spisak primalaca
 * daje M7 (pravila vidljivosti i dodela žive tamo), ne ovaj adapter. Transport i upis su u
 * `DistributionService.publishB2bSubagents` (treba DI); adapter drži samo OGRADU nad tekstom.
 */
export class B2bSubagentsAdapter implements DistributionChannelAdapter {
  private readonly logger = new Logger(B2bSubagentsAdapter.name);
  public readonly channelCode = 'B2B_SUBAGENTS';

  /** Postavlja `DistributionService` pre `publish()` — imena dobavljača koja tekst ne sme da sadrži. */
  forbiddenSupplierNames: string[] = [];

  /**
   * M7 §5b.3 — poruka subagentu nikad ne nosi nabavnu cenu, ime dobavljača ni broj jedinica.
   * Ograda u adapteru, ne oslanjanje na to da će AI „znati". Vraća razlog ili null.
   */
  forbiddenContentReason(content: NormalizedContentPiece): string | null {
    const text = `${content.title}\n${content.body}`;
    const lower = text.toLowerCase();
    for (const name of this.forbiddenSupplierNames) {
      const n = name.trim().toLowerCase();
      if (n.length >= 3 && lower.includes(n)) return `tekst sadrži ime dobavljača („${name}")`;
    }
    if (/\b(nabavn[aeiou]\w*|neto\s+cen\w*|net\s+rate)\b/i.test(text)) {
      return 'tekst pominje nabavnu/neto cenu';
    }
    if (
      /\b(još|jos|preostal\w*|slobodn\w*|imamo)\s+\d+\s+(sob[aeu]|jedinic\w*|mest[ao]|kreveta?)\b/i.test(
        text,
      )
    ) {
      return 'tekst otkriva broj raspoloživih jedinica';
    }
    return null;
  }

  async publish(content: NormalizedContentPiece): Promise<PublishResult> {
    this.logger.log(`B2B_SUBAGENTS: sadržaj ${content.contentPieceId} prošao ogradu teksta.`);
    return {
      externalPostId: `B2B-${content.contentPieceId}`,
      publishedAt: new Date().toISOString(),
    };
  }

  async unpublish(): Promise<void> {
    // Obaveštenje na portalu ostaje u istoriji (M7 §5b.2); već poslat mejl se ne povlači.
  }
}
