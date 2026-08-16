import { Injectable } from '@nestjs/common';
import { Mailbox } from '@prisma/client';
import { EmailProviderAdapter } from './email-provider-adapter.interface';
import { MockEmailProviderAdapter } from './mock-email-provider-adapter.service';

// M22 spec §10 — "Servis-fabrika bira adapter po Mailbox.providerConnectionRef/env". Svi
// sandučad koriste mock u ovom prolazu (isti obrazac kao M4 ProviderConfig.useMock, samo bez
// pravog provajdera za sada) — kad se doda prava konekcija, grananje ide ovde, ostatak modula
// se ne menja (poziva isključivo EmailProviderAdapter interfejs).
@Injectable()
export class EmailProviderFactory {
  constructor(private readonly mock: MockEmailProviderAdapter) {}

  getAdapter(_mailbox: Mailbox): EmailProviderAdapter {
    return this.mock;
  }
}
