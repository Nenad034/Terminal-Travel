import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Mailbox } from '@prisma/client';
import { EmailProviderAdapter, OutboundEmail, RawEmail, SendResult } from './email-provider-adapter.interface';

/**
 * M22 spec §10 (dopuna 5.9.2026) — prva implementacija `EmailProviderAdapter` koja STVARNO šalje.
 * Rešava polovinu nalaza 1.2 iz `39-REVIZIJA-KODA-NALAZI-I-PREDLOZI.md`: do danas je jedini
 * adapter bio mock, pa je svako „poslato" u bazi bilo neistinito.
 *
 * Zašto zaseban servis, a ne `common/mail/MailerService`: taj servis sopstvenom dokumentacijom
 * isključuje ovu upotrebu, i s razlogom — on šalje SISTEMSKU poštu sa jedne adrese kuće
 * (`MAIL_FROM`), dok M22 mora da šalje U IME POJEDINAČNOG SANDUČETA (`from` = `mailbox.address`),
 * da bi odgovor dobavljača stigao nazad u to isto sanduče i vezao se za nit. Zajedničko im je
 * samo `nodemailer` (već u steku od 4.9.2026, master dok. poglavlje 6) — nema nove zavisnosti.
 *
 * ŠTA OVAJ ADAPTER NE RADI: `fetchNewMessages` vraća prazan niz. SMTP je protokol za slanje —
 * dovlačenje pristigle pošte traži IMAP ili API provajdera (Gmail/Graph) i ostaje otvorena
 * stavka M22 §10. To je namerno i eksplicitno, ne previd: pola rešenog problema se prijavljuje
 * kao pola, ne kao ceo.
 *
 * Lokalno testiranje bez ijednog spoljnog naloga: `mailpit` iz `docker-compose.yml` hvata svu
 * poštu (SMTP 1025), pregled na `http://localhost:8025`. Nijedan mejl ne odlazi stvarnom
 * dobavljaču dok `SMTP_HOST` pokazuje na mailpit.
 */
@Injectable()
export class SmtpEmailProviderAdapter implements EmailProviderAdapter {
  private readonly logger = new Logger(SmtpEmailProviderAdapter.name);
  private transporter: Transporter | null = null;

  readonly providerCode = 'SMTP';

  constructor(private readonly config: ConfigService) {}

  /** Fabrika ovo pita pre nego što izabere ovaj adapter — bez hosta nema šta da se šalje. */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  async fetchNewMessages(mailbox: Mailbox): Promise<RawEmail[]> {
    this.logger.debug(
      `[SMTP] fetchNewMessages(${mailbox.address}) — SMTP ne ume da dovlači poštu (M22 §10, čeka IMAP/API provajdera). Vraća prazan niz.`,
    );
    return [];
  }

  async sendMessage(mailbox: Mailbox, message: OutboundEmail): Promise<SendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { providerMessageId: null, delivered: false, reason: 'SMTP_HOST nije podešen.' };
    }

    try {
      const info = await transporter.sendMail({
        // Ovo je cela poenta ovog adaptera — pošiljalac je sanduče, ne adresa kuće.
        from: `${mailbox.displayName} <${mailbox.address}>`,
        to: message.toAddresses,
        subject: message.subject,
        text: message.body,
        // Nit se kod dobavljača nastavlja preko standardnih zaglavlja; referentni kod u naslovu
        // (M5 §8.8 `[REF: TT-NNNNNN]`) je rezerva za slučaj da dobavljač pokrene nov mejl.
        inReplyTo: message.inReplyToProviderMessageId ?? undefined,
        references: message.inReplyToProviderMessageId ?? undefined,
      });
      this.logger.log(`[SMTP] Poslato sa ${mailbox.address} ka ${message.toAddresses.join(', ')} — "${message.subject}" (${info.messageId})`);
      return { providerMessageId: info.messageId ?? null, delivered: true };
    } catch (err) {
      // Nikad ne baca ka pozivaocu (isti graceful princip kao MailerService): priprema
      // dokumenta ne sme da padne zato što je pošta trenutno nedostupna. Pozivalac dobija
      // `delivered: false` i po M5 §8.4 ostavlja status na PENDING_SEND.
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SMTP] Slanje sa ${mailbox.address} nije uspelo: ${reason}`);
      return { providerMessageId: null, delivered: false, reason };
    }
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured()) return null;
    if (this.transporter) return this.transporter;

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    // Isto obrazloženje kao u MailerService: `SMTP_SECURE` je izričit jer se ne izvodi pouzdano
    // iz porta (465 je TLS od prvog bajta, 587/1025 idu na STARTTLS), a lokalni mailpit nema
    // ni TLS ni nalog — zato su `auth` i `secure` uslovni.
    const secure = (this.config.get<string>('SMTP_SECURE') ?? '').toLowerCase() === 'true' || port === 465;

    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    return this.transporter;
  }
}
