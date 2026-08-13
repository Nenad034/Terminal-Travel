import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { FiscalDocumentsService } from '../fiscal-documents/fiscal-documents.service';
import { ClientPaymentSchedulesService } from '../payment-terms/client-payment-schedules.service';
import { SupplierObligationsService } from '../supplier-obligations/supplier-obligations.service';

// M10 spec §6.0/§8.0/§5.4.2 — M10 se pretplaćuje na M5 booking.confirmed i automatski:
// (1) priprema FiscalDocument nacrt, (2) kreira ClientPaymentSchedule, (3) kreira
// SupplierObligation za svaku CONTRACTED stavku sa item_status=CONFIRMED. Sva tri nivo
// "Autonomno" (Master dokument poglavlje 7) — mehanička priprema, ništa spolja/finansijski
// nepovratno.
@Injectable()
export class M10EventSubscribersService implements OnModuleInit {
  private readonly logger = new Logger(M10EventSubscribersService.name);

  constructor(
    private readonly eventListener: EventListenerService,
    private readonly prisma: PrismaService,
    private readonly fiscalDocuments: FiscalDocumentsService,
    private readonly clientPaymentSchedules: ClientPaymentSchedulesService,
    private readonly supplierObligations: SupplierObligationsService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.onBookingConfirmed(payload.bookingId as string);
    });
    // M14 spec §3.2 — reklamacija rešena uz odluku o povraćaju: pripremi DRAFT storno nacrt.
    // M10 NE uvozi M14 direktno (izbegava kružnu zavisnost, isti obrazac odluke kao M7↔M10
    // credit_note.submitted) — event bus umesto DI poziva.
    this.eventListener.on('M14', 'ticket.resolved_with_refund', async (payload) => {
      await this.onTicketResolvedWithRefund(payload.relatedBookingId as string | null);
    });
  }

  async onBookingConfirmed(bookingId: string): Promise<void> {
    await this.fiscalDocuments.prepareDraft(bookingId);
    await this.clientPaymentSchedules.createForBooking(bookingId);

    const items = await this.prisma.bookingItem.findMany({
      where: { bookingId, sourceType: 'CONTRACTED', itemStatus: 'CONFIRMED' },
    });
    for (const item of items) {
      await this.supplierObligations.createFromBookingItem(item.id);
    }
  }

  async onTicketResolvedWithRefund(bookingId: string | null): Promise<void> {
    if (!bookingId) return; // §3.2 — tiket bez related_booking_id nema šta da se stornira
    await this.fiscalDocuments.prepareStornoDraftForBooking(bookingId);
  }
}
