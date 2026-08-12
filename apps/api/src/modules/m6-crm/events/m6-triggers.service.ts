import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { PostTripSurveysService } from '../post-trip-surveys/post-trip-surveys.service';

const PRE_DEPARTURE_OFFSETS_DAYS = [7, 3, 1]; // §4.2

function isSameMonthDay(date: Date, reference: Date): boolean {
  return date.getUTCMonth() === reference.getUTCMonth() && date.getUTCDate() === reference.getUTCDate();
}

function isDaysBefore(target: Date, reference: Date, days: number): boolean {
  const diffMs = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
    - Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate());
  return Math.round(diffMs / 86_400_000) === days;
}

/**
 * M6 spec §4.2 — automatizovane komunikacije po okidaču (rođendan/godišnjica/pred-put), nivo
 * "Autonomno": priprema CommunicationLog nacrt sa drafted_by_ai=true; ako je
 * ClientAccount.marketing_consent=true, smatra se poslatim (sent_by='SYSTEM_AUTO', isti obrazac
 * kao PostTripSurveysService.sendDueSurveys — nijedan ljudski nalog ne izvršava ovo slanje).
 * Bez saglasnosti, zapis ostaje kao nacrt (sent_by=null), čeka ljudsko slanje preko §4.1 toka.
 */
@Injectable()
export class M6TriggersService {
  private readonly logger = new Logger(M6TriggersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly postTripSurveys: PostTripSurveysService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyTriggers(): Promise<void> {
    await Promise.all([
      this.checkBirthdays(),
      this.checkAnniversaries(),
      this.checkPreDeparture(),
      this.postTripSurveys.sendDueSurveys(),
    ]);
  }

  private async logAutomatedTrigger(clientAccountId: string | null, guestProfileId: string | null, summary: string): Promise<void> {
    let consent = false;
    if (clientAccountId) {
      const account = await this.prisma.clientAccount.findUnique({ where: { id: clientAccountId } });
      consent = account?.marketingConsent ?? false;
    }
    await this.prisma.communicationLog.create({
      data: {
        clientAccountId,
        guestProfileId,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        summary,
        draftedByAi: true,
        sentBy: consent ? 'SYSTEM_AUTO' : null,
      },
    });
  }

  // §4.2 — rođendan gosta, godišnje na GuestProfile.date_of_birth.
  async checkBirthdays(): Promise<number> {
    const today = new Date();
    const guests = await this.prisma.guestProfile.findMany({ where: { linkedClientAccountId: { not: null } } });
    let count = 0;
    for (const guest of guests) {
      if (!isSameMonthDay(guest.dateOfBirth, today)) continue;
      await this.logAutomatedTrigger(guest.linkedClientAccountId, guest.id, `Čestitka za rođendan — ${guest.fullName}.`);
      count++;
    }
    return count;
  }

  // §4.2 — godišnjica prve Booking.confirmed_at po client_account_id.
  async checkAnniversaries(): Promise<number> {
    const today = new Date();
    const firstConfirmations = await this.prisma.booking.groupBy({
      by: ['clientAccountId'],
      where: { confirmedAt: { not: null } },
      _min: { confirmedAt: true },
    });
    let count = 0;
    for (const entry of firstConfirmations) {
      const firstConfirmedAt = entry._min.confirmedAt;
      if (!firstConfirmedAt || !isSameMonthDay(firstConfirmedAt, today)) continue;
      await this.logAutomatedTrigger(entry.clientAccountId, null, 'Godišnjica prve rezervacije.');
      count++;
    }
    return count;
  }

  // §4.2 — T-7/T-3/T-1 pred boravak, za aktivne potvrđene stavke.
  async checkPreDeparture(): Promise<number> {
    const today = new Date();
    const horizon = new Date(today.getTime() + Math.max(...PRE_DEPARTURE_OFFSETS_DAYS) * 24 * 60 * 60 * 1000);
    const items = await this.prisma.bookingItem.findMany({
      where: {
        itemStatus: 'CONFIRMED',
        stayFrom: { gte: today, lte: horizon },
        booking: { status: { in: ['CONFIRMED', 'MODIFIED'] } },
      },
      include: { booking: true },
    });
    let count = 0;
    for (const item of items) {
      const offset = PRE_DEPARTURE_OFFSETS_DAYS.find((d) => isDaysBefore(item.stayFrom, today, d));
      if (offset === undefined) continue;
      await this.logAutomatedTrigger(item.booking.clientAccountId, null, `Podsetnik pred put (T-${offset}) — rezervacija ${item.bookingId}.`);
      count++;
    }
    return count;
  }
}
