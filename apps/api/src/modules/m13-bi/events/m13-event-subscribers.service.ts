import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { FactSyncService } from '../sync/fact-sync.service';

// M13 spec §2 — pretplata na M5 Event Bus događaje, ažurira FactBooking projekciju u
// skoro-realnom-vremenu. Namerno resinhronizuje CELU rezervaciju (sve stavke), ne samo
// pojedinačnu stavku iz payload-a — booking.modified npr. nosi oldItemId/newItemId, a
// booking.cancelled niz itemIds; punom resinhronizacijom se izbegava da handler mora da
// prati tačan oblik svakog payload-a, po cenu par dodatnih (jeftinih) upisa. Pojedinačni
// izgubljeni događaj (pad servisa, mrežni problem) ispravlja noćna rekonsilijacija (§2,
// ReconciliationService) — ovo je namerna samoisceljujuća mera, ne propust.
@Injectable()
export class M13EventSubscribersService implements OnModuleInit {
  constructor(
    private readonly eventListener: EventListenerService,
    private readonly factSync: FactSyncService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.factSync.syncBooking(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.modified', async (payload) => {
      await this.factSync.syncBooking(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.cancelled', async (payload) => {
      await this.factSync.syncBooking(payload.bookingId as string);
    });
  }
}
