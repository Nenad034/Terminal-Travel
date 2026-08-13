import { Logger } from '@nestjs/common';
import {
  DistributionChannelAdapter,
  NormalizedContentPiece,
  PublishResult,
} from '../distribution-channel-adapter.interface';

/**
 * M12 spec §4 — "MOBILE_PUSH koristi već postojeći mehanizam push notifikacija iz M9 (M9
 * spec §5), ne novu infrastrukturu". M9 (Mobilna aplikacija) još nema implementaciju u kodu
 * (samo je specifikovan) — ovaj adapter je zato minimalan no-op stub, isti princip kao
 * ostali "čeka drugi modul" stubovi u repou (npr. M12 ne ide dalje od loga dok M9 ne postoji).
 * Kad M9 dobije kod, ovo mesto treba pozvati pravi M9 push servis (in-process DI), ne pre toga.
 */
export class MobilePushStubAdapter implements DistributionChannelAdapter {
  private readonly logger = new Logger(MobilePushStubAdapter.name);
  public readonly channelCode = 'MOBILE_PUSH';

  async publish(content: NormalizedContentPiece): Promise<PublishResult> {
    this.logger.warn(
      `[stub] MOBILE_PUSH kanal čeka M9 implementaciju — objava "${content.title}" (ContentPiece ${content.contentPieceId}) NIJE stvarno poslata, samo zabeležena.`,
    );
    return { externalPostId: `STUB-MOBILE_PUSH-${content.contentPieceId}`, publishedAt: new Date().toISOString() };
  }

  async unpublish(_externalPostId: string): Promise<void> {
    this.logger.warn('[stub] MOBILE_PUSH unpublish je no-op — čeka M9 implementaciju.');
  }
}
