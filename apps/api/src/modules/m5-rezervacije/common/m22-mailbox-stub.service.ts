import { Injectable, Logger } from '@nestjs/common';

/**
 * M5 spec §8.8 — slanje ka dobavljačima (SupplierManifest/SupplierChangeNotice) ide
 * isključivo kroz jedinstveno M22 `Mailbox` (mailbox_type = SHARED).
 *
 * ISPRAVKA KOMENTARA (5.9.2026, dok. 39 nalaz 1.2, zamka 13.2 — tvrdnja je preživela stanje
 * koje opisuje): do danas je ovde pisalo „M22 još nije implementiran". To VIŠE NIJE TAČNO —
 * `M22EmailInboxModule` je registrovan u `app.module.ts` i ima sandučad, niti i slanje nacrta.
 * Ono što nedostaje je jedan sloj niže: `MockEmailProviderAdapter` je jedina implementacija
 * `EmailProviderAdapter`, pa ni M22 ne šalje stvarno — čeka se VLASNIKOV IZBOR PROVAJDERA
 * (Gmail API / Microsoft Graph / IMAP-SMTP, M22 spec §10). Povezivanje ovog stub-a na M22 zato
 * danas ne bi poslalo nijedan mejl, samo bi pomerilo isto pretvaranje sloj dublje.
 *
 * Ni `common/mail/MailerService` nije zamena: on šalje SISTEMSKU poštu sa adrese kuće, a
 * najava dobavljaču ide U IME zajedničkog sandučeta i mora ostati u toj niti da bi odgovor
 * hotela imao gde da se veže — to sam MailerService izričito isključuje iz svoje namene.
 *
 * Trenutno samo loguje nameru slanja
 * (nikad ne blokira tok — priprema nacrta i status-prelaz DRAFT→SENT ostaju potpuno
 * funkcionalni bez stvarnog slanja mejla, isto kao što M11/M7 provere uvek prolaze dok
 * ti moduli ne postoje). Ne izmišljati M22 API oblik pre toga (CLAUDE.md — "šta ne raditi").
 */
@Injectable()
export class M22MailboxStubService {
  private readonly logger = new Logger(M22MailboxStubService.name);

  // TODO(M22): zameniti stvarnim slanjem kroz jedinstveno SHARED sanduče (M22 spec §2.1/§2.2)
  // sa naslovom u obliku "[REF: TT-NNNNNN] ..." (M5 spec §8.8) — uslov je izabran provajder
  // (M22 §10), ne dodatan kod ovde.
  //
  // POZNAT NEDOSTATAK (5.9.2026, dok. 39 nalaz 1.2): `sent: true` je neistinit povratni podatak
  // — pozivaoci na osnovu njega upisuju status SENT, `sentAt` i `announcedAt`, pa se pripremljeno
  // ne razlikuje od poslatog. Oblik iskrenog zapisa čeka vlasnikovu odluku (menja ponašanje, pa
  // traži dopunu M5 §8.4/§8.8 pre koda). Do tada trpimo neistinu SVESNO, ne neprimećeno.
  async sendViaSharedMailbox(params: {
    toEmail: string;
    referenceCode: string;
    subject: string;
    documentUrl?: string | null;
  }): Promise<{ sent: true; emailThreadId: null }> {
    this.logger.log(
      `[TODO M22] Slanje ka ${params.toEmail}: "[REF: ${params.referenceCode}] ${params.subject}" — M22 sanduče još ne postoji, mejl nije stvarno poslat.`,
    );
    return { sent: true, emailThreadId: null };
  }
}
