import { Injectable, Logger } from '@nestjs/common';

/**
 * M5 spec §8.8 — slanje ka dobavljačima (SupplierManifest/SupplierChangeNotice) ide
 * isključivo kroz jedinstveno M22 `Mailbox` (mailbox_type = SHARED). M22 (Email/Inbox
 * platforma) još nije implementiran (vidi tt-m22-email-inbox skill) — isti obrazac kao
 * ComplianceStubsService (M11/M7): ovaj servis je TODO stub/no-op koji dokumentuje tačku
 * gde će se M22 zakačiti kad taj modul dođe na red. Trenutno samo loguje nameru slanja
 * (nikad ne blokira tok — priprema nacrta i status-prelaz DRAFT→SENT ostaju potpuno
 * funkcionalni bez stvarnog slanja mejla, isto kao što M11/M7 provere uvek prolaze dok
 * ti moduli ne postoje). Ne izmišljati M22 API oblik pre toga (CLAUDE.md — "šta ne raditi").
 */
@Injectable()
export class M22MailboxStubService {
  private readonly logger = new Logger(M22MailboxStubService.name);

  // TODO(M22): zameniti stvarnim slanjem kroz jedinstveno SHARED sanduče (M22 spec §2.1/§2.2)
  // sa naslovom u obliku "[REF: TT-NNNNNN] ..." (M5 spec §8.8).
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
