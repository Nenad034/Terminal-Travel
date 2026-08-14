import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventListenerService } from '../../../common/events/event-listener.service';

// M9 spec §5 v1.4 — pretplaćuje se na postojeće Event Bus signale (isti obrazac kao M10
// M10EventSubscribersService) i šalje Expo push poruku ciljanom korisniku preko
// User.push_token. Odsustvo tokena (korisnik nije registrovao mobilni klijent) se tiho
// preskače — ovo nije greška, samo znači da korisnik trenutno ne koristi M9 aplikaciju.
@Injectable()
export class PushSenderService implements OnModuleInit {
  private readonly logger = new Logger(PushSenderService.name);
  private static readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(
    private readonly eventListener: EventListenerService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    // Gost: potvrda rezervacije (spec §5 "Gosti: potvrda rezervacije").
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.onBookingConfirmed(payload.bookingId as string, payload.bookingNumber as string);
    });

    // Vodič: URGENT beleška kolege na istoj turi (spec §5 "hitna ... URGENT ... od kolege
    // na istoj turi, ako je relevantno timski" — "relevantno" = drugi vodič dodeljen na
    // istu rezervaciju preko BookingItem.assigned_guide_id).
    this.eventListener.on('M9', 'field_incident.urgent', async (payload) => {
      await this.onFieldIncidentUrgent(payload.bookingId as string, payload.guideId as string, payload.note as string);
    });
  }

  private async onBookingConfirmed(bookingId: string, bookingNumber: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    const user = await this.prisma.user.findFirst({ where: { linkedProfileId: booking.clientAccountId, pushToken: { not: null } } });
    if (!user?.pushToken) return;

    await this.send(user.pushToken, 'Rezervacija potvrđena', `Vaša rezervacija ${bookingNumber} je potvrđena.`);
  }

  private async onFieldIncidentUrgent(bookingId: string, reportingGuideId: string, note: string): Promise<void> {
    const otherItems = await this.prisma.bookingItem.findMany({
      where: { bookingId, assignedGuideId: { not: null } },
      select: { assignedGuideId: true },
      distinct: ['assignedGuideId'],
    });
    const colleagueIds = [...new Set(otherItems.map((i) => i.assignedGuideId!).filter((id) => id !== reportingGuideId))];
    if (!colleagueIds.length) return;

    const colleagues = await this.prisma.user.findMany({ where: { id: { in: colleagueIds }, pushToken: { not: null } } });
    for (const colleague of colleagues) {
      if (!colleague.pushToken) continue;
      await this.send(colleague.pushToken, 'Hitna beleška na vašoj turi', note);
    }
  }

  private async send(pushToken: string, title: string, body: string): Promise<void> {
    try {
      await fetch(PushSenderService.EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: pushToken, title, body }),
      });
    } catch (err) {
      // Push je "best effort" — sistem od ranije nezavisno čuva istinu (audit log/podaci u bazi),
      // neuspešna dostava obaveštenja ne sme da obori dispatcher niti da izgubi podatak.
      this.logger.error(`Slanje push notifikacije nije uspelo: ${(err as Error).message}`);
    }
  }
}
