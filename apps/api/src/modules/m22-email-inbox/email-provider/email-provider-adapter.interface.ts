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
  /** Prazan kad isporuke nije bilo — nikad izmišljen identifikator (M22 §2.4, 5.9.2026). */
  providerMessageId: string | null;
  /**
   * Da li je provajder STVARNO primio poruku. Uveden 5.9.2026 (dok. 39 nalaz 1.2): ranije je
   * `sendMessage` vraćao samo `providerMessageId`, pa mock (koji ne šalje ništa) nije mogao da
   * se razlikuje od uspeha — pozivaoci su upisivali „poslato" za poštu koja ne izlazi iz kuće.
   * Nijedan pozivalac ne sme upisati isporuku bez `delivered === true`.
   */
  delivered: boolean;
  /** Popunjeno kad `delivered` nije tačno — ide u log/status, ne korisniku doslovno. */
  reason?: string;
}

export interface EmailProviderAdapter {
  providerCode: string;

  /** Poziva se pri periodičnom/ručnom pollingu — mock uvek vraća prazan niz (§10, nema žive konekcije). */
  fetchNewMessages(mailbox: Mailbox): Promise<RawEmail[]>;

  /**
   * Šalje poruku preko konekcije sandučeta. NIKAD ne baca izuzetak ka pozivaocu — greška se
   * vraća kao `{ delivered: false, reason }` (isti graceful princip kao `MailerService`), da
   * priprema dokumenta ne padne zato što je pošta trenutno nedostupna.
   */
  sendMessage(mailbox: Mailbox, message: OutboundEmail): Promise<SendResult>;
}
