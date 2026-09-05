import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailboxesService } from '../../m22-email-inbox/mailboxes/mailboxes.service';
import { EmailProviderFactory } from '../../m22-email-inbox/email-provider/email-provider.factory';

export interface SupplierSendResult {
  /** Jedina istina o tome da li je poruka otišla — pozivalac po njoj bira SENT ili PENDING_SEND. */
  delivered: boolean;
  /** Zašto nije otišla; ide u log i (skraćeno) korisniku. */
  reason?: string;
  /** M22 nit u kojoj poruka živi — `null` kad sanduče nije podešeno, pa niti ni nema. */
  emailThreadId: string | null;
}

/**
 * M5 spec §8.8 — SVA komunikacija ka dobavljaču vezana za rezervaciju (najava `SupplierManifest`,
 * izmena/storno `SupplierChangeNotice`) ide kroz JEDNO zajedničko M22 sanduče, ne sa ličnog
 * naloga zaposlenog koji klikne „pošalji". Razlog je vlasnikov problem iz prakse: kad svako
 * šalje sa svog mejla, potvrda hotela stiže na taj lični mejl i tim nema jedno mesto gde vidi
 * ceo tok „najavljeno → potvrđeno".
 *
 * NASLEDNIK `M22MailboxStubService` (obrisan 5.9.2026, dok. 39 nalaz 1.2). Stub je vraćao
 * `{ sent: true }` a nije slao ništa, pa su pozivaoci upisivali status SENT, `sent_at` i
 * `announced_at` za poštu koja nikad nije izašla iz kuće — hotel nije bio obavešten, a niko
 * to nije mogao da zna. Ovaj servis umesto toga radi stvaran posao i **vraća stvaran ishod**.
 *
 * Tok:
 *   1. nađi jedinstveno sanduče (`Mailbox.is_supplier_unified_inbox`) — nema ga → neisporučeno,
 *      bez izmišljanja uspeha;
 *   2. otvori (ili nastavi) `EmailThread` sa naslovom `[REF: TT-NNNNNN] ...`, vezanu na izvor
 *      preko `related_supplier_manifest_id`/`related_supplier_change_notice_id` (M22 §3.1a), da
 *      odgovor dobavljača ima gde da se prepozna;
 *   3. upiši `EmailMessage` (`OUTBOUND`/`STAFF`) i predaj je provajderu tog sandučeta;
 *   4. `delivered_at` samo ako je provajder potvrdio prijem (M22 §2.4).
 *
 * Nikad ne baca izuzetak ka pozivaocu — greška u pošti ne sme da sruši pripremu dokumenta
 * (isti graceful princip kao `MailerService` i `SmtpEmailProviderAdapter`).
 */
@Injectable()
export class SupplierMailboxService {
  private readonly logger = new Logger(SupplierMailboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailboxes: MailboxesService,
    private readonly providerFactory: EmailProviderFactory,
  ) {}

  async sendViaSharedMailbox(params: {
    toEmail: string;
    referenceCode: string;
    subject: string;
    body?: string;
    documentUrl?: string | null;
    supplierId?: string | null;
    supplierManifestId?: string | null;
    supplierChangeNoticeId?: string | null;
    actorUserId?: string | null;
  }): Promise<SupplierSendResult> {
    const mailbox = await this.mailboxes.findSupplierUnifiedInbox();
    if (!mailbox) {
      const reason =
        'Jedinstveno sanduče za dobavljače nije podešeno (M5 §8.8, Mailbox.is_supplier_unified_inbox). Poruka nije poslata.';
      this.logger.warn(`${reason} Primalac: ${params.toEmail}, ref ${params.referenceCode}.`);
      return { delivered: false, reason, emailThreadId: null };
    }

    // §8.8 — referentni kod na POČETKU naslova, u fiksnom obliku, da preživi i „Reply" i ručno
    // prekucan naslov (poklapanje odgovora ide preko njega, M22 §3.1a).
    const subject = `[REF: ${params.referenceCode}] ${params.subject}`;
    const body = params.body ?? this.defaultBody(params.subject, params.referenceCode, params.documentUrl);

    const thread = await this.prisma.emailThread.create({
      data: {
        mailboxId: mailbox.id,
        subject,
        correspondentType: 'SUPPLIER',
        correspondentSupplierId: params.supplierId ?? null,
        relatedSupplierManifestId: params.supplierManifestId ?? null,
        relatedSupplierChangeNoticeId: params.supplierChangeNoticeId ?? null,
      },
    });

    const message = await this.prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        senderType: 'STAFF',
        fromAddress: mailbox.address,
        toAddresses: [params.toEmail],
        body,
        sentBy: params.actorUserId ?? null,
      },
    });

    const adapter = this.providerFactory.getAdapter(mailbox);
    const result = await adapter.sendMessage(mailbox, {
      toAddresses: [params.toEmail],
      subject,
      body,
    });

    await this.prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        deliveredAt: result.delivered ? new Date() : null,
        providerMessageId: result.providerMessageId,
      },
    });

    if (!result.delivered) {
      this.logger.warn(`Poruka ka ${params.toEmail} (ref ${params.referenceCode}) NIJE isporučena: ${result.reason ?? 'bez razloga'}`);
    } else {
      this.logger.log(`Poslato ka ${params.toEmail} preko ${mailbox.address} — "${subject}"`);
    }

    return { delivered: result.delivered, reason: result.reason, emailThreadId: thread.id };
  }

  /**
   * Telo poruke kad pozivalac ne prosledi svoje. Namerno kratko i bez izmišljenih podataka —
   * sadržaj liste je u priloženom dokumentu, a ovde stoji samo ono što je sigurno tačno.
   */
  private defaultBody(subject: string, referenceCode: string, documentUrl?: string | null): string {
    const lines = [
      'Poštovani,',
      '',
      `u prilogu/na linku je ${subject.toLowerCase()}.`,
      documentUrl ? `Dokument: ${documentUrl}` : null,
      '',
      `Molimo Vas da u odgovoru zadržite oznaku ${referenceCode} u naslovu, kako bismo Vašu potvrdu automatski povezali sa rezervacijom.`,
      '',
      'Hvala unapred,',
      'Terminal Travel',
    ];
    return lines.filter((l) => l !== null).join('\n');
  }
}
