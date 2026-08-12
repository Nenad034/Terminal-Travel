import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { PaymentTermsConfigService } from './payment-terms-config.service';

// M10 spec §5.4.2/§5.4.3 — rok akontacije i pune uplate prema gostu/nalogodavcu, kao globalna
// agencijska politika snimljena u trenutku kreiranja rasporeda (ne živi vezano na konfiguraciju).
@Injectable()
export class ClientPaymentSchedulesService {
  private readonly logger = new Logger(ClientPaymentSchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly paymentTerms: PaymentTermsConfigService,
  ) {}

  // §5.4.2 — poziva se automatski po booking.confirmed (isti trigger obrazac kao §6.0/§8.0).
  async createForBooking(bookingId: string) {
    const existing = await this.prisma.clientPaymentSchedule.findUnique({ where: { bookingId } });
    if (existing) return existing;

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) return null;

    const config = await this.paymentTerms.getActive();

    const depositAmount = Math.round((booking.totalPrice * Number(config.depositPercentage)) / 100);
    const depositDueDate = addDays(booking.confirmedAt ?? new Date(), config.depositDueDaysAfterConfirmation);

    const earliestStayFrom = booking.items.reduce<Date | null>((earliest, item) => {
      if (!earliest || item.stayFrom < earliest) return item.stayFrom;
      return earliest;
    }, null);
    const balanceDueDate = addDays(earliestStayFrom ?? new Date(), -config.balanceDueDaysBeforeStay);

    return this.prisma.clientPaymentSchedule.create({
      data: { bookingId, depositAmount, depositDueDate, balanceDueDate },
    });
  }

  // §5.4.3 — poziva se posle svake nove RECEIVED uplate za booking_id.
  async onPaymentReceived(bookingId: string) {
    const schedule = await this.prisma.clientPaymentSchedule.findUnique({ where: { bookingId } });
    if (!schedule) return;

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    const receivedSum = await this.sumReceivedPayments(bookingId);
    const data: { depositStatus?: 'MET'; balanceStatus?: 'MET' } = {};

    if (schedule.depositStatus !== 'MET' && receivedSum >= schedule.depositAmount) data.depositStatus = 'MET';
    if (schedule.balanceStatus !== 'MET' && booking.paymentStatus === 'PAID') {
      data.balanceStatus = 'MET';
      data.depositStatus = 'MET'; // §5.4.3 — balance MET povlači i deposit MET, bez obzira na redosled uplata
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.clientPaymentSchedule.update({ where: { bookingId }, data });
    }
  }

  // §5.4.3/§8.2 obrazac — @Cron poziva ovo periodično; čisto informativno, nikad ne menja Booking.
  async checkOverdueAndEscalate() {
    const config = await this.paymentTerms.getActive().catch(() => null);
    if (!config) return; // politika još nije podešena — ništa za proveriti

    const now = new Date();
    const pending = await this.prisma.clientPaymentSchedule.findMany({
      where: { OR: [{ depositStatus: { in: ['PENDING', 'OVERDUE'] } }, { balanceStatus: { in: ['PENDING', 'OVERDUE'] } }] },
    });

    for (const schedule of pending) {
      await this.checkOneDeadline(schedule, 'deposit', schedule.depositDueDate, schedule.depositStatus, now, config.escalationDaysAfterDue);
      await this.checkOneDeadline(schedule, 'balance', schedule.balanceDueDate, schedule.balanceStatus, now, config.escalationDaysAfterDue);
    }
  }

  private async checkOneDeadline(
    schedule: { id: string; bookingId: string },
    kind: 'deposit' | 'balance',
    dueDate: Date,
    status: string,
    now: Date,
    escalationDaysAfterDue: number,
  ) {
    if (status === 'MET' || dueDate.getTime() >= now.getTime()) return;

    const daysOverdue = (now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000);
    const severity = daysOverdue >= escalationDaysAfterDue ? 'CRITICAL' : 'WARNING';

    if (status !== 'OVERDUE') {
      await this.prisma.clientPaymentSchedule.update({
        where: { id: schedule.id },
        data: kind === 'deposit' ? { depositStatus: 'OVERDUE' } : { balanceStatus: 'OVERDUE' },
      });
    }

    // §5.4.3 — HealthSignal tipa PAYMENT_DEADLINE_MISSED (M18 još ne postoji kao model,
    // isti obrazac kao M3 low_capacity_critical / M4 provider_error_spike preko Event Bus-a).
    await this.eventBus.emit('M10', 'payment_deadline_missed', { bookingId: schedule.bookingId, kind, severity });
  }

  private async sumReceivedPayments(bookingId: string): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: { bookingId, status: 'RECEIVED' },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
