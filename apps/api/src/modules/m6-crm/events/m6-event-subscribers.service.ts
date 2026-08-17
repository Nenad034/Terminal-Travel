import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { ClientLoyaltyStatusService } from '../loyalty/client-loyalty-status.service';
import { PostTripSurveysService } from '../post-trip-surveys/post-trip-surveys.service';
import { ClientAccountsService } from '../client-accounts/client-accounts.service';

// M6 spec §3.2 (booking.confirmed/booking.cancelled → preračun lojalnosti), §4.3
// (booking.completed → kreiranje PostTripSurvey) i §6 (M1 user.registered.guest →
// ClientAccount za samostalno registrovanog gosta). Isti obrazac kao M11EventSubscribersService.
@Injectable()
export class M6EventSubscribersService implements OnModuleInit {
  constructor(
    private readonly eventListener: EventListenerService,
    private readonly prisma: PrismaService,
    private readonly loyaltyStatus: ClientLoyaltyStatusService,
    private readonly postTripSurveys: PostTripSurveysService,
    private readonly clientAccounts: ClientAccountsService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.recalculateLoyalty(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.cancelled', async (payload) => {
      await this.recalculateLoyalty(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.completed', async (payload) => {
      await this.postTripSurveys.createForBooking(payload.bookingId as string);
    });
    this.eventListener.on('M1', 'user.registered.guest', async (payload) => {
      await this.createClientAccountForGuest(
        payload.userId as string,
        payload.email as string,
        payload.fullName as string,
        (payload.phone as string | null | undefined) ?? null,
      );
    });
  }

  // M6 spec §6 — GuestProfile se namerno NE pravi ovde (traži podatke o putnom
  // dokumentu koje registracija ne prikuplja); pravi se kasnije, kad gost stvarno
  // unese te podatke (tok rezervacije ili profil naloga).
  // Ispravka avgust 2026 (otkriveno pri M8 poglavlje 3 korak 3 implementaciji) —
  // `phone` se ranije gubio: RegisterDto ga prikuplja i upisuje na User, ali
  // event payload/ovaj handler ga nisu prenosili dalje na ClientAccount, pa je
  // `ClientAccount.phone` ostajao trajno prazan za SVAKOG samostalno registrovanog
  // gosta (ne samo novi "nastavi bez naloga" tok) — popravljeno u oba fajla.
  private async createClientAccountForGuest(userId: string, email: string, fullName: string, phone: string | null): Promise<void> {
    const account = await this.clientAccounts.create({
      accountType: 'INDIVIDUAL',
      fullName,
      email,
      phone: phone ?? undefined,
    });
    await this.prisma.user.update({ where: { id: userId }, data: { linkedProfileId: account.id } });
  }

  private async recalculateLoyalty(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;
    await this.loyaltyStatus.recalculate(booking.clientAccountId);
  }
}
