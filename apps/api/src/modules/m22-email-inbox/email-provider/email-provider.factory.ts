import { Injectable, Logger } from '@nestjs/common';
import { Mailbox } from '@prisma/client';
import { EmailProviderAdapter } from './email-provider-adapter.interface';
import { MockEmailProviderAdapter } from './mock-email-provider-adapter.service';
import { SmtpEmailProviderAdapter } from './smtp-email-provider-adapter.service';

/**
 * M22 spec §10 — "Servis-fabrika bira adapter po `Mailbox.providerConnectionRef`/env".
 *
 * Do 5.9.2026 je uvek vraćala mock (jedina implementacija). Sada bira PO SANDUČETU, kako spec
 * §2.1 i predviđa: `provider_connection_ref = "smtp:env"` znači „koristi SMTP podešavanje
 * okruženja". Sve ostalo i dalje dobija mock — uključujući slučaj kad sanduče traži SMTP a
 * `SMTP_HOST` nije podešen, jer je tada mock (koji pošteno kaže `delivered: false`) tačniji
 * odgovor od SMTP adaptera koji nema kuda da se poveže.
 *
 * Kad vlasnik izabere pravog provajdera (Gmail API / Microsoft Graph / IMAP), dodaje se nova
 * klasa i jedna grana ovde — ostatak modula se ne menja (poziva isključivo interfejs).
 */
export const SMTP_ENV_CONNECTION_REF = 'smtp:env';

@Injectable()
export class EmailProviderFactory {
  private readonly logger = new Logger(EmailProviderFactory.name);

  constructor(
    private readonly mock: MockEmailProviderAdapter,
    private readonly smtp: SmtpEmailProviderAdapter,
  ) {}

  getAdapter(mailbox: Mailbox): EmailProviderAdapter {
    if (mailbox.providerConnectionRef === SMTP_ENV_CONNECTION_REF) {
      if (this.smtp.isConfigured()) return this.smtp;
      this.logger.warn(
        `Sanduče ${mailbox.address} traži SMTP, ali SMTP_HOST nije podešen — pada na mock (poruke se NE šalju, status ostaje "čeka slanje").`,
      );
    }
    return this.mock;
  }
}
