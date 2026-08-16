import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailCorrespondentType, EmailThread } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { MailboxesService } from '../mailboxes/mailboxes.service';
import { EmailProviderFactory } from '../email-provider/email-provider.factory';
import { RawEmail } from '../email-provider/email-provider-adapter.interface';
import { CorrespondentMatcherService } from '../correspondent-matching/correspondent-matcher.service';
import { ReferenceMatcherService } from '../reference-matching/reference-matcher.service';
import { EmailAiAssistantService } from '../ai-assistant/email-ai-assistant.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { LinkBookingDto } from './dto/link-booking.dto';
import { LinkSupplierAnnouncementDto } from './dto/link-supplier-announcement.dto';

export interface FindThreadsFilter {
  mailboxId?: string;
  status?: string;
  correspondentType?: string;
}

// Nedostatak 2 (M17 Faza 7) — čist dodatak na EmailThread payload, samo adresa/naziv sandučeta na
// koje pozivalac već ima MailboxAccess (nema novih polja u bazi, nema promene autorizacije).
type EmailThreadWithMailbox = EmailThread & { mailbox: { address: string; displayName: string } };

// M22 spec §2.3/§2.4/§3.1/§3.1a/§8 — vidljivost/pisanje niti se NIKAD ne izvodi iz opšte M1
// uloge, isključivo iz MailboxAccess po sandučetu (isti dvoslojni obrazac kao M19
// SupplierConversationAccess): @RequirePermission na kontroleru je gruba kapija ("ova vrsta
// naloga uopšte sme da pokuša"), ova klasa je fina kapija ("baš OVO sanduče/nit").
@Injectable()
export class EmailThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailboxes: MailboxesService,
    private readonly providerFactory: EmailProviderFactory,
    private readonly correspondentMatcher: CorrespondentMatcherService,
    private readonly referenceMatcher: ReferenceMatcherService,
    private readonly aiAssistant: EmailAiAssistantService,
  ) {}

  private async accessibleMailboxIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.mailboxAccess.findMany({ where: { userId }, select: { mailboxId: true } });
    return rows.map((r) => r.mailboxId);
  }

  private async requireAccess(mailboxId: string, userId: string, minLevel: 'VIEW' | 'REPLY'): Promise<void> {
    const access = await this.mailboxes.findAccess(mailboxId, userId);
    if (!access) {
      throw new ForbiddenException(`Nemaš MailboxAccess za sanduče ${mailboxId} — pristup se dodeljuje pojedinačno (§2.2).`);
    }
    if (minLevel === 'REPLY' && access.accessLevel !== 'REPLY') {
      throw new ForbiddenException(`MailboxAccess nivo VIEW ne dozvoljava odgovaranje — potreban je REPLY (§2.2).`);
    }
  }

  // §8 GET /threads — SAMO sandučad za koje pozivalac ima MailboxAccess (bilo koji nivo), bez
  // obzira na ulogu (čak ni Vlasnik/Direktor ne vide tuđe sanduče bez eksplicitne dodele, §2.2).
  //
  // Nedostatak 2 (M17 Faza 7) — odgovor uključuje `mailbox: { address, displayName }` (čisto
  // proširenje payload-a već autorizovanog upita — isti scoping kao pre, pozivalac već ima
  // MailboxAccess na svako sanduče koje vidi u ovom nizu). Ranije je bilo dostupno samo preko
  // GET /email/mailboxes koji zahteva M22/mailbox/VIEW (Vlasnik/Direktor) — obična osoba sa
  // MailboxAccess bez tog admin prava nije mogla da vidi naziv sandučeta na koje sama gleda.
  async findMany(actorUserId: string, filter: FindThreadsFilter): Promise<EmailThreadWithMailbox[]> {
    const accessible = await this.accessibleMailboxIds(actorUserId);
    if (accessible.length === 0) return [];

    let mailboxIdIn = accessible;
    if (filter.mailboxId) {
      if (!accessible.includes(filter.mailboxId)) return [];
      mailboxIdIn = [filter.mailboxId];
    }

    return this.prisma.emailThread.findMany({
      where: {
        mailboxId: { in: mailboxIdIn },
        status: filter.status as never,
        correspondentType: filter.correspondentType as never,
      },
      include: { mailbox: { select: { address: true, displayName: true } } },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findOne(id: string, actorUserId: string): Promise<EmailThreadWithMailbox & { messages: unknown[] }> {
    const thread = await this.prisma.emailThread.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        mailbox: { select: { address: true, displayName: true } },
      },
    });
    if (!thread) throw new NotFoundException(`EmailThread ${id} nije pronađen.`);
    await this.requireAccess(thread.mailboxId, actorUserId, 'VIEW');
    return thread;
  }

  private async loadThreadWithAccess(threadId: string, actorUserId: string, minLevel: 'VIEW' | 'REPLY'): Promise<EmailThread> {
    const thread = await this.prisma.emailThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`EmailThread ${threadId} nije pronađen.`);
    await this.requireAccess(thread.mailboxId, actorUserId, minLevel);
    return thread;
  }

  // §8 POST /threads/:id/messages — isključivo STAFF poruke (ljudski, autentikovan poziv), zahteva
  // REPLY. AI_DRAFT poruke nastaju SAMO kroz EmailAiAssistantService.processInboundMessage.
  async createMessage(threadId: string, dto: CreateMessageDto, actorUserId: string) {
    const thread = await this.loadThreadWithAccess(threadId, actorUserId, 'REPLY');
    const mailbox = await this.mailboxes.findOne(thread.mailboxId);

    let providerMessageId: string | null = null;
    const sentBy = dto.send ? actorUserId : null;
    if (dto.send) {
      const adapter = this.providerFactory.getAdapter(mailbox);
      const result = await adapter.sendMessage(mailbox, { toAddresses: [], subject: thread.subject, body: dto.body });
      providerMessageId = result.providerMessageId;
    }

    const message = await this.prisma.emailMessage.create({
      data: {
        threadId,
        direction: 'OUTBOUND',
        senderType: 'STAFF',
        fromAddress: mailbox.address,
        toAddresses: [],
        body: dto.body,
        sentBy,
        providerMessageId,
      },
    });

    await this.prisma.emailThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date(), status: dto.send ? 'OPEN' : thread.status },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M22',
      action: dto.send ? 'email_message.sent' : 'email_message.drafted',
      resourceType: 'EmailMessage',
      resourceId: message.id,
      afterState: message,
      context: { threadId },
    });

    return message;
  }

  // §8 POST /threads/:id/messages/:messageId/send — čovek potvrđuje AI/STAFF nacrt (sentBy=null),
  // zahteva REPLY. Poruka koja već ima sentBy popunjeno ne sme biti ponovo poslata.
  async sendDraft(threadId: string, messageId: string, actorUserId: string) {
    const thread = await this.loadThreadWithAccess(threadId, actorUserId, 'REPLY');
    const mailbox = await this.mailboxes.findOne(thread.mailboxId);

    const message = await this.prisma.emailMessage.findUnique({ where: { id: messageId } });
    if (!message || message.threadId !== threadId) throw new NotFoundException(`EmailMessage ${messageId} nije pronađen u niti ${threadId}.`);
    if (message.direction !== 'OUTBOUND') throw new BadRequestException('Samo OUTBOUND poruke (nacrti) se šalju preko ove rute.');
    if (message.sentBy) throw new BadRequestException('Poruka je već poslata.');

    const adapter = this.providerFactory.getAdapter(mailbox);
    const result = await adapter.sendMessage(mailbox, { toAddresses: message.toAddresses, subject: thread.subject, body: message.body });

    const sent = await this.prisma.emailMessage.update({
      where: { id: messageId },
      data: { sentBy: actorUserId, providerMessageId: message.providerMessageId ?? result.providerMessageId },
    });

    await this.prisma.emailThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date(), status: 'OPEN' } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M22',
      action: 'email_message.draft_sent',
      resourceType: 'EmailMessage',
      resourceId: sent.id,
      afterState: sent,
      context: { threadId, wasSenderType: message.senderType },
    });

    return sent;
  }

  // §8 POST /threads/:id/link-booking — zahteva REPLY, upisuje SAMO EmailThread.related_booking_id.
  async linkBooking(threadId: string, dto: LinkBookingDto, actorUserId: string) {
    await this.loadThreadWithAccess(threadId, actorUserId, 'REPLY');
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${dto.bookingId} nije pronađen.`);

    const thread = await this.prisma.emailThread.update({ where: { id: threadId }, data: { relatedBookingId: dto.bookingId } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M22',
      action: 'email_thread.link_booking',
      resourceType: 'EmailThread',
      resourceId: threadId,
      afterState: thread,
    });
    return thread;
  }

  // §3.1a/§8 POST /threads/:id/link-supplier-announcement — zahteva REPLY. Upisuje ISKLJUČIVO
  // EmailThread.related_supplier_manifest_id/related_supplier_change_notice_id — NIKAD ne poziva
  // M5 confirmSupplier() niti bilo koji M5 servis/endpoint. Konačna M5 potvrda ostaje isključivo
  // ljudski klik na M5/supplier-confirmation/CONFIRM, van ovog modula.
  async linkSupplierAnnouncement(threadId: string, dto: LinkSupplierAnnouncementDto, actorUserId: string) {
    await this.loadThreadWithAccess(threadId, actorUserId, 'REPLY');

    const data: { relatedSupplierManifestId?: string; relatedSupplierChangeNoticeId?: string } = {};
    if (dto.announcementType === 'SUPPLIER_MANIFEST') {
      const manifest = await this.prisma.supplierManifest.findUnique({ where: { id: dto.announcementId } });
      if (!manifest) throw new NotFoundException(`SupplierManifest ${dto.announcementId} nije pronađen.`);
      data.relatedSupplierManifestId = manifest.id;
    } else {
      const changeNotice = await this.prisma.supplierChangeNotice.findUnique({ where: { id: dto.announcementId } });
      if (!changeNotice) throw new NotFoundException(`SupplierChangeNotice ${dto.announcementId} nije pronađen.`);
      data.relatedSupplierChangeNoticeId = changeNotice.id;
    }

    const thread = await this.prisma.emailThread.update({ where: { id: threadId }, data });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M22',
      action: 'email_thread.link_supplier_announcement',
      resourceType: 'EmailThread',
      resourceId: threadId,
      afterState: thread,
      context: { announcementType: dto.announcementType, announcementId: dto.announcementId },
    });
    return thread;
  }

  // §3.1/§3.1a/§4/§9 — interni ulaz (nema sopstvenu HTTP rutu u ovom prolazu, isti princip kao
  // M18 healthDetectors.checkX() — poziva se iz zakazanog pollinga kad pravi provajder postoji
  // (§10, mock adapter uvek vraća prazan niz) ili direktno iz testova/simulacije. Za NOVU nit
  // (prva poruka) pokreće CorrespondentMatcherService + (za jedinstveno sanduče dobavljača, M5
  // §8.8) ReferenceMatcherService — obe determinističke, bez poziva jezičkom modelu. Na SVAKU
  // INBOUND poruku (nova ili postojeća nit) pokreće EmailAiAssistantService.processInboundMessage
  // (§9 izlazni kriterijum — sažetak/nacrt na svaku dolaznu poruku).
  async receiveInboundMessage(mailboxId: string, raw: RawEmail): Promise<EmailThread> {
    const mailbox = await this.mailboxes.findOne(mailboxId);

    let thread = await this.prisma.emailThread.findFirst({
      where: { mailboxId, subject: raw.subject, status: { not: 'CLOSED' } },
    });

    if (!thread) {
      const correspondent = await this.correspondentMatcher.match(raw.fromAddress);
      let relatedSupplierManifestId: string | null = null;
      let relatedSupplierChangeNoticeId: string | null = null;

      if (mailbox.isSupplierUnifiedInbox) {
        const referenceMatch = await this.referenceMatcher.match(raw.subject, raw.body, raw.fromAddress);
        relatedSupplierManifestId = referenceMatch.relatedSupplierManifestId;
        relatedSupplierChangeNoticeId = referenceMatch.relatedSupplierChangeNoticeId;
      }

      const correspondentType: EmailCorrespondentType = mailbox.isSupplierUnifiedInbox
        ? 'SUPPLIER'
        : correspondent.correspondentType;

      thread = await this.prisma.emailThread.create({
        data: {
          mailboxId,
          subject: raw.subject,
          correspondentType,
          correspondentClientAccountId: correspondent.correspondentClientAccountId,
          correspondentSupplierId: correspondent.correspondentSupplierId,
          relatedSupplierManifestId,
          relatedSupplierChangeNoticeId,
          status: 'AWAITING_REPLY',
          lastMessageAt: new Date(raw.receivedAt),
        },
      });
    } else {
      thread = await this.prisma.emailThread.update({
        where: { id: thread.id },
        data: { status: 'AWAITING_REPLY', lastMessageAt: new Date(raw.receivedAt) },
      });
    }

    const message = await this.prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'INBOUND',
        senderType: 'CORRESPONDENT',
        fromAddress: raw.fromAddress,
        toAddresses: raw.toAddresses,
        body: raw.body,
        providerMessageId: raw.providerMessageId,
        receivedAt: new Date(raw.receivedAt),
      },
    });

    await this.aiAssistant.processInboundMessage(message);

    return thread;
  }
}
