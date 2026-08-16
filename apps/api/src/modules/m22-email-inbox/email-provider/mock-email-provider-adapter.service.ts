import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Mailbox } from '@prisma/client';
import { EmailProviderAdapter, OutboundEmail, RawEmail, SendResult } from './email-provider-adapter.interface';

// M22 spec §10 (otvoreno za dalje) — jedina implementacija EmailProviderAdapter u ovom prolazu.
// Isti graceful stil kao M18 EmailClientService/M12 EmailMockAdapter — nikad ne puca, samo
// loguje šta bi bilo urađeno. Sistem je spreman da se poveže na pravu konekciju (Gmail API/
// Microsoft Graph/IMAP-SMTP) čim vlasnik izabere provajdera — samo nova klasa koja implementira
// isti EmailProviderAdapter interfejs, ostatak modula se ne menja.
@Injectable()
export class MockEmailProviderAdapter implements EmailProviderAdapter {
  private readonly logger = new Logger(MockEmailProviderAdapter.name);

  readonly providerCode = 'MOCK';

  async fetchNewMessages(mailbox: Mailbox): Promise<RawEmail[]> {
    this.logger.debug(`[MOCK] fetchNewMessages(${mailbox.address}) — nema žive konekcije u ovom prolazu, vraća prazan niz.`);
    return [];
  }

  async sendMessage(mailbox: Mailbox, message: OutboundEmail): Promise<SendResult> {
    this.logger.warn(
      `[MOCK] Email sa ${mailbox.address} ka ${message.toAddresses.join(', ')} NIJE stvarno poslat (provider konekcija čeka odluku vlasnika, M22 spec §10) — subject: "${message.subject}", body: ${message.body.slice(0, 200)}`,
    );
    return { providerMessageId: `mock-${randomUUID()}` };
  }
}
