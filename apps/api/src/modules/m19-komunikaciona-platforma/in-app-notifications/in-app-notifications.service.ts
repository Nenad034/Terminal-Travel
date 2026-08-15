import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { SYSTEM_ROLES } from '../../m1-core-identitet/roles/system-roles.constants';

// M19 spec §5 — "M18 upozorenja... dobijaju channel_type = IN_APP — sistemska poruka se ubacuje
// u posebnu 'Obaveštenja' konverzaciju svakog relevantnog korisnika". Implementaciona odluka
// (spec §9.5 stil odluke "odlučiti pri implementaciji, dokumentovati izbor" — ovde primenjeno na
// §5, isti duh): "svaki relevantan korisnik" = isti krug kome M18/health-signal/VIEW pripada po
// seed-u (Vlasnik/Direktor, jedini nosioci te dozvole) — birano DIREKTNO preko uloga (SYSTEM_ROLES)
// umesto ponovnog obilaska NotificationChannel.recipient_role konfiguracije, jer je taj mehanizam
// namenjen Telegram/email kanalima sa sopstvenim opt-in podešavanjem, ne IN_APP-u koji je uvek
// uključen za interni tim. "Obaveštenja" konverzacija = type=DIRECT sa sistemskim pošiljaocem
// (seed korisnik, vidi seed.ts) + ciljanim korisnikom — odabrano nad novim type=SYSTEM jer ne
// zahteva izmenu ConversationType enuma niti ConversationsService grananja (spec §9.3 varijanta
// "ili nov type=SYSTEM — odlučiti pri implementaciji", dokumentovano ovde po pravilu iz spec-a).
@Injectable()
export class InAppNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(InAppNotificationsService.name);
  static readonly SYSTEM_USER_EMAIL = 'obavestenja-sistem@sistem.terminal-travel.local';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventListener: EventListenerService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M18', 'health-signal.critical', async (payload) => {
      await this.deliverCriticalSignal(payload as { signalId: string; sourceModule: string; signalType: string; details: unknown });
    });
  }

  private async deliverCriticalSignal(payload: { signalId: string; sourceModule: string; signalType: string; details: unknown }): Promise<void> {
    const systemUser = await this.prisma.user.findUnique({ where: { email: InAppNotificationsService.SYSTEM_USER_EMAIL } });
    if (!systemUser) {
      this.logger.warn('Sistemski nalog za obaveštenja (seed) ne postoji — IN_APP isporuka preskočena.');
      return;
    }

    const roles = await this.prisma.role.findMany({
      where: { name: { in: [SYSTEM_ROLES.VLASNIK, SYSTEM_ROLES.DIREKTOR] } },
    });
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId: { in: roles.map((r) => r.id) } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const text = `[CRITICAL] ${payload.sourceModule} — ${payload.signalType}\n${JSON.stringify(payload.details)}`;

    // Paralelno, ne sekvencijalno — jedan spor/neuspešan primalac ne sme da odloži isporuku
    // ostalima (isti princip kao M9 PushSenderService.onFieldIncidentUrgent, koje takođe ne čeka
    // jedan po jedan primaoca).
    await Promise.all(
      userRoles.map(async ({ userId }) => {
        const conversationId = await this.ensureNotificationsConversation(userId, systemUser.id);
        await this.prisma.message.create({ data: { conversationId, senderId: systemUser.id, body: text } });
      }),
    );
  }

  private async ensureNotificationsConversation(userId: string, systemUserId: string): Promise<string> {
    const candidates = await this.prisma.conversation.findMany({
      where: { type: 'DIRECT', participants: { some: { userId } } },
      include: { participants: true },
    });
    const existing = candidates.find(
      (c) => c.participants.length === 2 && c.participants.some((p) => p.userId === systemUserId),
    );
    if (existing) return existing.id;

    const conversation = await this.prisma.conversation.create({
      data: { type: 'DIRECT', name: 'Obaveštenja', createdBy: systemUserId },
    });
    await this.prisma.conversationParticipant.createMany({
      data: [
        { conversationId: conversation.id, userId },
        { conversationId: conversation.id, userId: systemUserId },
      ],
    });
    return conversation.id;
  }
}
