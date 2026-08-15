import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { AuthService } from '../../m1-core-identitet/auth/auth.service';
import { GrantAccessDto } from './dto/grant-access.dto';
import { InviteContactDto } from './dto/invite-contact.dto';

// M19 spec §9.2/§9.4/§9.7 — dodela pristupa internog tima EXTERNAL_SUPPLIER razgovoru
// (SupplierConversationAccess, isti dvoslojni obrazac kao M22 MailboxAccess) i pokretanje
// lakog portal naloga za SupplierContact (§9.2 koraci 1-3).
@Injectable()
export class SupplierConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly permissions: PermissionsService,
    private readonly auth: AuthService,
  ) {}

  private async assertGrantAccessPermission(actorUserId: string): Promise<void> {
    const allowed = await this.permissions.hasPermission(actorUserId, 'M19', 'supplier-conversation', 'GRANT_ACCESS');
    if (!allowed) throw new ForbiddenException('Nema dozvolu M19/supplier-conversation/GRANT_ACCESS');
  }

  private async findExternalSupplierConversation(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.type !== 'EXTERNAL_SUPPLIER') {
      throw new NotFoundException(`EXTERNAL_SUPPLIER razgovor ${conversationId} nije pronađen.`);
    }
    return conversation;
  }

  async listAccess(conversationId: string, actorUserId: string) {
    await this.assertGrantAccessPermission(actorUserId);
    await this.findExternalSupplierConversation(conversationId);
    return this.prisma.supplierConversationAccess.findMany({ where: { conversationId } });
  }

  // §9.4 — grant upisuje i SupplierConversationAccess (audit ko/kad) i ConversationParticipant
  // (stvarno članstvo/WS soba) u istoj transakciji — namerna odluka implementacije da ova dva
  // ostanu uvek u sinhronizaciji (dokumentovano u §00-OBJASNJENJE fajlu).
  async grantAccess(conversationId: string, dto: GrantAccessDto, actorUserId: string) {
    await this.assertGrantAccessPermission(actorUserId);
    await this.findExternalSupplierConversation(conversationId);

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser || targetUser.accountType !== 'STAFF') {
      throw new BadRequestException('Pristup se dodeljuje isključivo internom (STAFF) korisniku.');
    }

    const [access] = await this.prisma.$transaction([
      this.prisma.supplierConversationAccess.upsert({
        where: { conversationId_userId: { conversationId, userId: dto.userId } },
        update: {},
        create: { conversationId, userId: dto.userId, grantedBy: actorUserId },
      }),
      this.prisma.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId: dto.userId } },
        update: {},
        create: { conversationId, userId: dto.userId },
      }),
    ]);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M19',
      action: 'supplier_conversation.access_granted',
      resourceType: 'SupplierConversationAccess',
      resourceId: access.id,
      afterState: access,
      context: { conversationId, userId: dto.userId },
    });
    return access;
  }

  async revokeAccess(conversationId: string, userId: string, actorUserId: string) {
    await this.assertGrantAccessPermission(actorUserId);
    await this.findExternalSupplierConversation(conversationId);

    const access = await this.prisma.supplierConversationAccess.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!access) throw new NotFoundException('Pristup nije pronađen.');

    await this.prisma.$transaction([
      this.prisma.supplierConversationAccess.delete({ where: { id: access.id } }),
      this.prisma.conversationParticipant.deleteMany({ where: { conversationId, userId } }),
    ]);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M19',
      action: 'supplier_conversation.access_revoked',
      resourceType: 'SupplierConversationAccess',
      resourceId: access.id,
      beforeState: access,
      context: { conversationId, userId },
    });
    return { revoked: true };
  }

  // §9.2 koraci 1-3/§9.7 — kreira User (account_type=SUPPLIER_CONTACT), šalje pozivnicu (isti
  // mehanizam kao AuthService.createInviteToken, M1 spec §5) i popunjava
  // SupplierContact.linked_user_id. NE koristi UsersService.invite() (taj metod hardkoduje
  // account_type=STAFF i zahteva roleIds — namerno drugačiji tok za spoljni nalog, isti razlog
  // zašto AuthService.register (GUEST) takođe ne prolazi kroz UsersService.invite).
  async inviteContact(conversationId: string, dto: InviteContactDto, actorUserId: string) {
    await this.assertGrantAccessPermission(actorUserId);
    const conversation = await this.findExternalSupplierConversation(conversationId);

    const contact = await this.prisma.supplierContact.findUnique({ where: { id: dto.supplierContactId } });
    if (!contact || contact.supplierId !== conversation.supplierId) {
      throw new BadRequestException('Kontakt-osoba ne pripada dobavljaču ovog razgovora.');
    }
    if (contact.linkedUserId) {
      throw new BadRequestException('Kontakt-osoba već ima portal nalog.');
    }

    // §9.3 — tačno jedan SUPPLIER_CONTACT po EXTERNAL_SUPPLIER razgovoru.
    const existingContactParticipants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
    });
    const existingUsers = await this.prisma.user.findMany({
      where: { id: { in: existingContactParticipants.map((p) => p.userId) }, accountType: 'SUPPLIER_CONTACT' },
    });
    if (existingUsers.length > 0) {
      throw new BadRequestException('Ovaj razgovor već ima dodeljenu kontakt-osobu dobavljača.');
    }

    const existingUserWithEmail = await this.prisma.user.findUnique({ where: { email: contact.email } });
    if (existingUserWithEmail) {
      throw new ConflictException(`Nalog sa email-om ${contact.email} već postoji.`);
    }

    const user = await this.prisma.user.create({
      data: {
        email: contact.email,
        fullName: contact.fullName,
        phone: contact.phone,
        accountType: 'SUPPLIER_CONTACT',
        status: 'INVITED',
        linkedProfileId: contact.id,
      },
    });

    const inviteToken = await this.auth.createInviteToken(user.id);

    await this.prisma.$transaction([
      this.prisma.supplierContact.update({ where: { id: contact.id }, data: { linkedUserId: user.id } }),
      this.prisma.conversationParticipant.create({ data: { conversationId, userId: user.id } }),
    ]);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M19',
      action: 'supplier_conversation.contact_invited',
      resourceType: 'User',
      resourceId: user.id,
      afterState: { userId: user.id, supplierContactId: contact.id },
      context: { conversationId },
    });

    // Slanje email-a sa linkom je van obima ovog fajla (isti obrazac kao UsersService.invite) —
    // pozivalac (panel) dobija sirov token i prikazuje link koji tim ručno prosleđuje dobavljaču,
    // dok stvarna email integracija ne dođe na red.
    return { user, inviteToken };
  }
}
