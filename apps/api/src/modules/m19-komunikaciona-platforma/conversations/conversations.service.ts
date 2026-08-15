import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

// M19 spec §2/§8/§9.3/§9.7 — REST prefiks /chat, primarni izvor istine za razgovore/poruke.
// WS ChatGateway poziva iste metode (createMessage) da ne duplira logiku slanja — WS je samo
// dodatan realtime kanal isporuke, ne poseban put upisa (spec §3).
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly permissions: PermissionsService,
    private readonly eventBus: EventBusService,
  ) {}

  // §2.2/§9.3 — DIRECT/GROUP: isključivo STAFF; EXTERNAL_SUPPLIER: STAFF (uz grant, §9.4) +
  // tačno jedan SUPPLIER_CONTACT (dodat kasnije preko invite-contact toka, ne ovde).
  private async assertStaffUsers(userIds: string[]): Promise<void> {
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
    if (users.length !== userIds.length) {
      throw new BadRequestException('Jedan ili više navedenih korisnika ne postoji.');
    }
    if (users.some((u) => u.accountType !== 'STAFF')) {
      throw new BadRequestException('DIRECT/GROUP razgovor prihvata isključivo interne (STAFF) učesnike.');
    }
  }

  private async assertParticipant(conversationId: string, actorUserId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException(`Razgovor ${conversationId} nije pronađen.`);

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: actorUserId } },
    });
    // Namerno 404, ne 403 — spec §9.2/§9.4 traži da razgovor bude nevidljiv, ne samo zabranjen,
    // za nekoga ko nije učesnik (isti obrazac kao M14 TicketsService ownership provera).
    if (!participant) throw new NotFoundException(`Razgovor ${conversationId} nije pronađen.`);

    return { conversation, participant };
  }

  async findAllForUser(actorUserId: string) {
    const memberships = await this.prisma.conversationParticipant.findMany({
      where: { userId: actorUserId },
      include: { conversation: true },
    });

    const result = [];
    for (const m of memberships) {
      const lastMessage = await this.prisma.message.findFirst({
        where: { conversationId: m.conversationId },
        orderBy: { sentAt: 'desc' },
      });
      result.push({
        id: m.conversation.id,
        type: m.conversation.type,
        name: m.conversation.name,
        supplierId: m.conversation.supplierId,
        createdAt: m.conversation.createdAt,
        lastReadAt: m.lastReadAt,
        lastMessage: lastMessage
          ? { id: lastMessage.id, senderId: lastMessage.senderId, body: lastMessage.deletedAt ? null : lastMessage.body, sentAt: lastMessage.sentAt }
          : null,
      });
    }
    return result.sort((a, b) => {
      const aTime = a.lastMessage?.sentAt ?? a.createdAt;
      const bTime = b.lastMessage?.sentAt ?? b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  async findOne(conversationId: string, actorUserId: string) {
    const { conversation } = await this.assertParticipant(conversationId, actorUserId);
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: { conversation: false },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: participants.map((p) => p.userId) } },
      select: { id: true, fullName: true, accountType: true },
    });
    return {
      ...conversation,
      participants: participants.map((p) => ({
        userId: p.userId,
        joinedAt: p.joinedAt,
        lastReadAt: p.lastReadAt,
        user: users.find((u) => u.id === p.userId) ?? null,
      })),
    };
  }

  // §2.1/§9.3/§9.7 — POST /chat/conversations. EXTERNAL_SUPPLIER kreiranje odmah upisuje
  // SupplierConversationAccess za tvorca (self-grant — on je taj koji je svesno zatražio pristup,
  // isti princip kao M22 prvi MailboxAccess red pri kreiranju sandučeta).
  async create(dto: CreateConversationDto, actorUserId: string) {
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);
    if (identity.accountType !== 'STAFF') {
      throw new ForbiddenException('Samo interni tim (STAFF) može kreirati razgovor.');
    }

    if (dto.type === 'EXTERNAL_SUPPLIER') {
      const allowed = await this.permissions.hasPermission(actorUserId, 'M19', 'supplier-conversation', 'GRANT_ACCESS');
      if (!allowed) throw new ForbiddenException('Nema dozvolu M19/supplier-conversation/GRANT_ACCESS');
      if (!dto.supplierId) throw new BadRequestException('supplierId je obavezan za EXTERNAL_SUPPLIER razgovor.');

      const conversation = await this.prisma.conversation.create({
        data: { type: 'EXTERNAL_SUPPLIER', supplierId: dto.supplierId, createdBy: actorUserId },
      });
      await this.prisma.$transaction([
        this.prisma.conversationParticipant.create({ data: { conversationId: conversation.id, userId: actorUserId } }),
        this.prisma.supplierConversationAccess.create({
          data: { conversationId: conversation.id, userId: actorUserId, grantedBy: actorUserId },
        }),
      ]);

      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: actorUserId,
        module: 'M19',
        action: 'supplier_conversation.created',
        resourceType: 'Conversation',
        resourceId: conversation.id,
        afterState: conversation,
        context: { supplierId: dto.supplierId },
      });
      return conversation;
    }

    const allowed = await this.permissions.hasPermission(actorUserId, 'M19', 'conversation', 'CREATE');
    if (!allowed) throw new ForbiddenException('Nema dozvolu M19/conversation/CREATE');

    const otherParticipantIds = (dto.participantUserIds ?? []).filter((id) => id !== actorUserId);
    if (otherParticipantIds.length === 0) {
      throw new BadRequestException('participantUserIds mora sadržati bar jednog drugog učesnika.');
    }
    if (dto.type === 'DIRECT' && otherParticipantIds.length !== 1) {
      throw new BadRequestException('DIRECT razgovor prihvata tačno jednog drugog učesnika.');
    }
    if (dto.type === 'GROUP' && !dto.name) {
      throw new BadRequestException('GROUP razgovor zahteva naziv (name).');
    }
    await this.assertStaffUsers(otherParticipantIds);

    if (dto.type === 'DIRECT') {
      const existing = await this.findExistingDirectConversation(actorUserId, otherParticipantIds[0]);
      if (existing) return existing;
    }

    const allParticipantIds = [actorUserId, ...otherParticipantIds];
    const conversation = await this.prisma.conversation.create({
      data: { type: dto.type, name: dto.type === 'GROUP' ? dto.name : null, createdBy: actorUserId },
    });
    await this.prisma.conversationParticipant.createMany({
      data: allParticipantIds.map((userId) => ({ conversationId: conversation.id, userId })),
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M19',
      action: 'conversation.created',
      resourceType: 'Conversation',
      resourceId: conversation.id,
      afterState: conversation,
      context: { participantUserIds: allParticipantIds },
    });
    return conversation;
  }

  private async findExistingDirectConversation(userIdA: string, userIdB: string) {
    const candidates = await this.prisma.conversation.findMany({
      where: { type: 'DIRECT', participants: { some: { userId: userIdA } } },
      include: { participants: true },
    });
    return candidates.find((c) => c.participants.length === 2 && c.participants.some((p) => p.userId === userIdB)) ?? null;
  }

  async findMessages(conversationId: string, actorUserId: string) {
    await this.assertParticipant(conversationId, actorUserId);
    const messages = await this.prisma.message.findMany({ where: { conversationId }, orderBy: { sentAt: 'asc' } });
    return messages.map((m) => ({ ...m, body: m.deletedAt ? null : m.body }));
  }

  // §3/§8 — zajednička ulazna tačka za slanje poruke, koriste je i REST fallback kontroler i
  // ChatGateway (`message.send`). Vraća i listu učesnika koji NISU trenutno ONLINE (§3 —
  // "primalac trenutno nije povezan"), koje pozivalac (gateway ili ovaj servis sam) koristi da
  // odluči da li treba emitovati M9 push (spec §3 zadnja rečenica).
  async createMessage(conversationId: string, dto: CreateMessageDto, actorUserId: string) {
    const { conversation } = await this.assertParticipant(conversationId, actorUserId);
    await this.assertCanSend(conversation.type, actorUserId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: actorUserId, body: dto.body },
    });
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: actorUserId } },
      data: { lastReadAt: new Date() },
    });

    const otherParticipants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: actorUserId } },
    });
    const presences = await this.prisma.presenceStatus.findMany({
      where: { userId: { in: otherParticipants.map((p) => p.userId) } },
    });
    const sender = await this.prisma.user.findUnique({ where: { id: actorUserId } });

    for (const participant of otherParticipants) {
      const presence = presences.find((p) => p.userId === participant.userId);
      const isOnline = presence?.status === 'ONLINE';
      if (!isOnline) {
        // §3 — "mobilni klijent dodatno šalje push notifikaciju kroz mehanizam koji M9 već ima".
        // M19 samo emituje na Event Bus (isti obrazac kao M5 booking.confirmed →
        // PushSenderService u M9) — namerno bez direktnog DI uvoza M9 modula, spec §"Nalazi
        // istraživanja" traži da modul ostane samostalan.
        await this.eventBus.emit('M19', 'message.recipient_offline', {
          conversationId,
          messageId: message.id,
          recipientUserId: participant.userId,
          senderName: sender?.fullName ?? 'Terminal Travel',
          bodyPreview: dto.body.slice(0, 120),
        });
      }
    }

    await this.eventBus.emit('M19', 'message.new', { conversationId, messageId: message.id, senderId: actorUserId });

    return message;
  }

  private async assertCanSend(conversationType: string, actorUserId: string): Promise<void> {
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);
    // §9.6 — SUPPLIER_CONTACT nema poseban ključ dozvole u M1 katalogu; učešće (assertParticipant
    // iznad) je jedina i dovoljna ograda, isti obrazac kao SUBAGENT_ADMIN.
    if (identity.accountType === 'SUPPLIER_CONTACT') return;

    const resource = conversationType === 'EXTERNAL_SUPPLIER' ? 'supplier-conversation' : 'conversation';
    const allowed = await this.permissions.hasPermission(actorUserId, 'M19', resource, 'SEND_MESSAGE');
    if (!allowed) throw new ForbiddenException(`Nema dozvolu M19/${resource}/SEND_MESSAGE`);
  }

  async editMessage(messageId: string, dto: UpdateMessageDto, actorUserId: string) {
    const message = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId } });
    if (message.senderId !== actorUserId) throw new ForbiddenException('Samo pošiljalac može izmeniti poruku.');
    if (message.deletedAt) throw new BadRequestException('Obrisana poruka se ne može izmeniti.');

    return this.prisma.message.update({ where: { id: messageId }, data: { body: dto.body, editedAt: new Date() } });
  }

  async deleteMessage(messageId: string, actorUserId: string) {
    const message = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId } });
    if (message.senderId !== actorUserId) throw new ForbiddenException('Samo pošiljalac može obrisati poruku.');

    return this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  }

  async markRead(conversationId: string, actorUserId: string) {
    await this.assertParticipant(conversationId, actorUserId);
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: actorUserId } },
      data: { lastReadAt: new Date() },
    });
  }
}
