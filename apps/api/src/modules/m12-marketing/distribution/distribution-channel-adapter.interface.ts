// M12 spec §4 — isti oblik kao M4 ProviderAdapter (apps/api/src/modules/m4-integracije-api/
// provider-adapter.interface.ts), ali za marketinške distribucione kanale umesto dobavljača
// turističkog proizvoda/inventara. Namerno poseban interfejs — M4 je eksplicitno ograničen na
// "dobavljače turističkog proizvoda/inventara" (M4 spec §1), pa ne pokriva Facebook/Instagram/
// Email/Mobile push.

export interface NormalizedContentPiece {
  contentPieceId: string;
  type: string;
  title: string;
  body: string;
  languageCode: string;
  trackingCode: string;
  slug: string | null;
  /** M8 link sa ?ref=<tracking_code> (§3a) — adapter ga umeće u objavu gde format kanala dozvoljava. Null dok M8 frontend rute (§3b) ne postoje. */
  linkUrl: string | null;
  containsAiGeneratedMedia: boolean;
}

export interface PublishResult {
  externalPostId: string;
  publishedAt: string; // ISO datum
}

export interface DistributionChannelAdapter {
  channelCode: string; // npr. "FACEBOOK", "INSTAGRAM", "EMAIL"

  publish(content: NormalizedContentPiece): Promise<PublishResult>;
  unpublish(externalPostId: string): Promise<void>;
}
