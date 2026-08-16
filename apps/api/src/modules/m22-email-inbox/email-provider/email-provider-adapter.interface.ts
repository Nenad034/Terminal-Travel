// M22 spec §10 (otvoreno za dalje — izbor provajdera) — generički ugovor, isti obrazac kao
// M4 ProviderAdapter (m4-integracije-api/provider-adapter.interface.ts §2). Mock je jedina
// implementacija ovog prolaza; kad vlasnik izabere pravog provajdera (Gmail API/Microsoft
// Graph/IMAP-SMTP), nova klasa implementira ovaj isti interfejs, ostatak modula se ne menja.
import { Mailbox } from '@prisma/client';

export interface RawEmail {
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  body: string;
  providerMessageId: string;
  receivedAt: string; // ISO datum
}

export interface OutboundEmail {
  toAddresses: string[];
  subject: string;
  body: string;
  inReplyToProviderMessageId?: string | null;
}

export interface SendResult {
  providerMessageId: string;
}

export interface EmailProviderAdapter {
  providerCode: string;

  /** Poziva se pri periodičnom/ručnom pollingu — mock uvek vraća prazan niz (§10, nema žive konekcije). */
  fetchNewMessages(mailbox: Mailbox): Promise<RawEmail[]>;

  /** Šalje poruku preko konekcije sandučeta — mock samo loguje "poslao bi" (graceful, isti stil kao M18 EmailClientService). */
  sendMessage(mailbox: Mailbox, message: OutboundEmail): Promise<SendResult>;
}
