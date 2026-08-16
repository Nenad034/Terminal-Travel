import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateMailboxDto } from './dto/create-mailbox.dto';
import { GrantMailboxAccessDto } from './dto/grant-mailbox-access.dto';

// M22 spec §2.1/§2.2 — upravljanje sandučadima i pojedinačna dodela pristupa. Pristup se NIKAD
// ne izvodi iz opšte M1 uloge (§2.2) — čak i Vlasnik/Direktor moraju biti eksplicitno dodati na
// sanduče da bi videli niti (izuzetak samo ako je tako eksplicitno dodeljeno preko MailboxAccess).
@Injectable()
export class MailboxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.mailbox.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const mailbox = await this.prisma.mailbox.findUnique({ where: { id } });
    if (!mailbox) throw new NotFoundException(`Mailbox ${id} nije pronađen.`);
    return mailbox;
  }

  // §2.2 — "Vlasnik PERSONAL sandučeta dobija REPLY automatski pri kreiranju sandučeta — ne mora
  // se ručno dodeliti sam sebi." Sprovedeno u servisnom sloju (transakcija), ne DB trigerom.
  // §8.8 M5 — najviše jedan Mailbox sme nositi is_supplier_unified_inbox=true (pojednostavljenje
  // dokumentovano u schema.prisma komentaru, nema parcijalni unique indeks u ovom prolazu).
  async create(dto: CreateMailboxDto, actorUserId: string) {
    if (dto.mailboxType === 'PERSONAL' && !dto.ownerUserId) {
      throw new BadRequestException('PERSONAL sanduče zahteva ownerUserId.');
    }
    if (dto.mailboxType === 'SHARED' && dto.ownerUserId) {
      throw new BadRequestException('SHARED sanduče ne sme imati ownerUserId.');
    }
    if (dto.isSupplierUnifiedInbox) {
      const existing = await this.prisma.mailbox.findFirst({ where: { isSupplierUnifiedInbox: true } });
      if (existing) {
        throw new BadRequestException(
          `Već postoji jedinstveno sanduče za dobavljače (${existing.address}, M5 §8.8) — samo jedno sme biti obeleženo.`,
        );
      }
    }

    const mailbox = await this.prisma.mailbox.create({
      data: {
        address: dto.address,
        displayName: dto.displayName,
        mailboxType: dto.mailboxType,
        ownerUserId: dto.ownerUserId ?? null,
        providerConnectionRef: dto.providerConnectionRef,
        isSupplierUnifiedInbox: dto.isSupplierUnifiedInbox ?? false,
      },
    });

    if (mailbox.mailboxType === 'PERSONAL' && mailbox.ownerUserId) {
      await this.prisma.mailboxAccess.create({
        data: {
          mailboxId: mailbox.id,
          userId: mailbox.ownerUserId,
          accessLevel: 'REPLY',
          grantedBy: actorUserId,
        },
      });
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M22',
      action: 'mailbox.create',
      resourceType: 'Mailbox',
      resourceId: mailbox.id,
      afterState: mailbox,
    });

    return mailbox;
  }

  async listAccess(mailboxId: string) {
    await this.findOne(mailboxId);
    return this.prisma.mailboxAccess.findMany({ where: { mailboxId }, orderBy: { grantedAt: 'asc' } });
  }

  // §2.2 — POST /mailboxes/:id/access, zahteva M22/mailbox-access/GRANT (kontroler).
  async grantAccess(mailboxId: string, dto: GrantMailboxAccessDto, actorUserId: string) {
    await this.findOne(mailboxId);

    const access = await this.prisma.mailboxAccess.upsert({
      where: { mailboxId_userId: { mailboxId, userId: dto.userId } },
      update: { accessLevel: dto.accessLevel, grantedBy: actorUserId },
      create: { mailboxId, userId: dto.userId, accessLevel: dto.accessLevel, grantedBy: actorUserId },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M22',
      action: 'mailbox_access.grant',
      resourceType: 'MailboxAccess',
      resourceId: access.id,
      afterState: access,
      context: { mailboxId, userId: dto.userId },
    });

    return access;
  }

  /** Interna pomoćna metoda — koriste je EmailThreadsService/EmailAiAssistantService za scoping. */
  async findAccess(mailboxId: string, userId: string) {
    return this.prisma.mailboxAccess.findUnique({ where: { mailboxId_userId: { mailboxId, userId } } });
  }

  /** M5 spec §8.8 — čita jedinstveno sanduče za dobavljače (najviše jedan red), koristi ga ReferenceMatcherService. */
  async findSupplierUnifiedInbox() {
    return this.prisma.mailbox.findFirst({ where: { isSupplierUnifiedInbox: true } });
  }
}
