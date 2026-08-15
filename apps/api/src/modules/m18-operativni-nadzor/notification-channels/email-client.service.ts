import { Injectable, Logger } from '@nestjs/common';

// M18 spec §3 — EMAIL kanal, namerno mock u ovom prolazu (isti status kao M12
// EmailMockAdapter, apps/api/src/modules/m12-marketing/distribution/adapters/email.adapter.ts).
// Slanje prave pošte zahteva ili SMTP biblioteku (npr. nodemailer) ili spoljni provajder
// (SendGrid/SES) — nova zavisnost van tehničkog steka (docs/00-MASTER-ARHITEKTURA.md poglavlje
// 6), pa zahteva potvrdu vlasnika pre uvođenja (CLAUDE.md). Do te odluke, ovaj servis samo
// loguje šta bi bilo poslato — isporuka nikad ne puca, samo tiho izostane.
@Injectable()
export class EmailClientService {
  private readonly logger = new Logger(EmailClientService.name);

  isConfigured(): boolean {
    return false; // namerno — vidi napomenu iznad, nema SMTP integracije u ovom prolazu
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.warn(`[MOCK] Email ka ${to} NIJE stvarno poslat (SMTP integracija čeka odluku vlasnika o biblioteci) — subject: "${subject}", body: ${body.slice(0, 200)}`);
  }
}
