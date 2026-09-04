import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface OutgoingMail {
  to: string | string[];
  subject: string;
  /** Čist tekst — uvek obavezan (neki klijenti ne prikazuju HTML, a i filteri ga traže). */
  text: string;
  html?: string;
  replyTo?: string;
}

export interface MailSendResult {
  delivered: boolean;
  messageId?: string;
  /** Popunjeno kad slanje nije uspelo — pozivalac ga upisuje u log/audit, ne prikazuje gostu. */
  error?: string;
}

/**
 * Zajedničko slanje SISTEMSKE (transakcione) pošte — pozivnica, reset lozinke, operativna
 * uzbuna. Jedno mesto za ceo `apps/api`, umesto da svaki modul nosi svoju mock implementaciju
 * (do 4.9.2026 ih je bilo četiri: M1 nije slao ništa, M18 `EmailClientService`, M12
 * `EmailMockAdapter`, M22 `MockEmailProviderAdapter` — svaka je čekala „odluku vlasnika o
 * biblioteci", pa nijedan email nikad nije otišao).
 *
 * NIJE za: marketinške kampanje (M12 — traži pristanak, odjavu i throttling, poglavlje 4 te
 * specifikacije) ni za sandučad iz M22 (tamo se šalje U IME sandučeta, preko konekcije tog
 * sandučeta, što je zaseban provajderski izbor — M22 §10).
 *
 * Dva pravila oblikuju ovaj servis:
 *
 * 1. **Nikad ne baca izuzetak ka pozivaocu.** Ako SMTP nije podešen ili server odbije poruku,
 *    vraća `{ delivered: false }` i loguje. Razlog: pozivanje kolege ne sme da padne zato što
 *    je pošta trenutno nedostupna — nalog je već napravljen, a link se u panelu prikazuje i
 *    prosleđuje ručno (M1 spec §5). Isti graceful-degradation princip kao `ANTHROPIC_API_KEY`
 *    i `GEMINI_API_KEY` u ostatku steka.
 * 2. **Bez podešenog `SMTP_HOST` ponaša se kao dosadašnji mock** — loguje šta bi poslao, ne
 *    puca. Sveža radna kopija time radi bez ijedne dodatne postavke.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  /** Adresa pošiljaoca za sistemsku poštu; `MAIL_FROM` ima prednost nad SMTP korisnikom. */
  fromAddress(): string {
    return (
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('SMTP_USER') ??
      'no-reply@terminal-travel.local'
    );
  }

  /** Osnova za linkove u porukama (aktivacija, reset) — panel, ne API. */
  panelBaseUrl(): string {
    return (this.config.get<string>('PANEL_BASE_URL') ?? 'http://localhost:3100').replace(/\/+$/, '');
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured()) return null;
    if (this.transporter) return this.transporter;

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    // `SMTP_SECURE` je izričit jer se ne može pouzdano izvesti iz porta: 465 je uvek TLS od
    // prvog bajta, 587 i 1025 kreću kao čist tekst pa idu na STARTTLS. Lokalni mailpit
    // (docker-compose) nema ni TLS ni nalog — zato su i `auth` i `secure` uslovni.
    const secure = (this.config.get<string>('SMTP_SECURE') ?? '').toLowerCase() === 'true' || port === 465;

    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  async send(mail: OutgoingMail): Promise<MailSendResult> {
    const recipients = Array.isArray(mail.to) ? mail.to.join(', ') : mail.to;
    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(
        `Email ka ${recipients} NIJE poslat — SMTP_HOST nije podešen (vidi apps/api/.env.example). Naslov: "${mail.subject}"`,
      );
      return { delivered: false, error: 'SMTP nije podešen' };
    }

    try {
      const info = await transporter.sendMail({
        from: this.fromAddress(),
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        replyTo: mail.replyTo,
      });
      this.logger.log(`Email poslat ka ${recipients} — "${mail.subject}" (${info.messageId})`);
      return { delivered: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Namerno `error` nivo a ne bacanje: neuspela pošta je vidljiv kvar, ali ne sme da
      // sruši radnju koja ju je izazvala (poglavlje pravila iznad).
      this.logger.error(`Slanje email-a ka ${recipients} nije uspelo ("${mail.subject}"): ${message}`);
      return { delivered: false, error: message };
    }
  }
}
