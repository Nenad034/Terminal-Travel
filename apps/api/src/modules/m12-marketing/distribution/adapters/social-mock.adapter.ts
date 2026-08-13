import { Logger } from '@nestjs/common';
import {
  DistributionChannelAdapter,
  NormalizedContentPiece,
  PublishResult,
} from '../distribution-channel-adapter.interface';

/**
 * M12 spec §4 / §9 ("Otvoreno za dalje" — tačan izbor društvenih mreža čeka potvrdu pre
 * pravih adaptera) — mock/stub implementacija za FACEBOOK/INSTAGRAM, isti nivo apstrakcije
 * kao M4 MockProviderAdapter (apps/api/src/modules/m4-integracije-api/adapters/mock-provider.adapter.ts):
 * ne gađa nijedan spoljni API, samo simulira uspešnu objavu i loguje. Kredencijali (kad se
 * unesu preko /channels) čuvaju se enkriptovano (ChannelConfig.authConfigEncrypted, isti
 * obrazac kao M4 ProviderConfig.authConfigEncrypted) — ovaj adapter ih ne koristi jer ne
 * poziva pravi Facebook/Instagram Graph API.
 */
export class SocialMockAdapter implements DistributionChannelAdapter {
  private readonly logger = new Logger(SocialMockAdapter.name);

  constructor(public readonly channelCode: 'FACEBOOK' | 'INSTAGRAM') {}

  async publish(content: NormalizedContentPiece): Promise<PublishResult> {
    const externalPostId = `MOCK-${this.channelCode}-${content.contentPieceId}`;
    this.logger.log(
      `[mock] Objava na ${this.channelCode}: "${content.title}" (ContentPiece ${content.contentPieceId}, tracking_code=${content.trackingCode})`,
    );
    return { externalPostId, publishedAt: new Date().toISOString() };
  }

  async unpublish(externalPostId: string): Promise<void> {
    this.logger.log(`[mock] Uklanjanje objave ${externalPostId} sa ${this.channelCode}`);
  }
}
