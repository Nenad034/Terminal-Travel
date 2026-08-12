import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { ClientContractsService } from '../client-contracts/client-contracts.service';

// M20 spec §3.1/§3.4 — pretplata na M5 booking.confirmed (automatsko generisanje) i
// booking.modified (obavezna revizija). booking.cancelled NAMERNO nije ovde — otkazivanje ne
// pokreće reviziju, originalni ugovor ostaje merodavan istorijski zapis (§3.4).
@Injectable()
export class M20EventSubscribersService implements OnModuleInit {
  constructor(
    private readonly eventListener: EventListenerService,
    private readonly clientContracts: ClientContractsService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.clientContracts.generateForBooking(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.modified', async (payload) => {
      await this.clientContracts.voidAndRegenerateForModification(payload.bookingId as string);
    });
  }
}
