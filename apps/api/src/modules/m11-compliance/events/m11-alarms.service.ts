import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventBusService } from '../../../common/events/event-bus.service';
import { TravelGuaranteeService } from '../travel-guarantee/travel-guarantee.service';
import { TravelGuaranteeRegistrationsService } from '../travel-guarantee-registrations/travel-guarantee-registrations.service';

// M11 spec §2.1 (60/30/7 dana), §2.2 (grace period), §2.3 (dva 48h alarma) — periodični, čisto
// informativni alarmi. Nivo "Autonomno" (Master dokument poglavlje 7) — nijedan od ovih poziva
// ne menja Booking/TravelGuarantee/TravelGuaranteeRegistration stanje osim same registracije
// (deterministički CIS pokušaj, ne odluka), samo emituje signale preko Event Bus-a.
@Injectable()
export class M11AlarmsService {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly travelGuarantee: TravelGuaranteeService,
    private readonly registrations: TravelGuaranteeRegistrationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyChecks(): Promise<void> {
    await Promise.all([
      this.travelGuarantee.checkAndEmitHealthSignals(),
      this.checkMissingRegistrations(),
      this.checkReleasePending(),
    ]);
  }

  // §2.3 alarm 1 — CONFIRMED rezervacija bez status=REGISTERED duže od 48h.
  async checkMissingRegistrations(): Promise<void> {
    const missing = await this.registrations.findMissingRegistrationOlderThan(48);
    for (const registration of missing) {
      await this.eventBus.emit('M11', 'travel_guarantee_registration_missing', {
        travelGuaranteeRegistrationId: registration.id,
        bookingId: registration.bookingId,
      });
    }
  }

  // §2.3 alarm 2 — CANCELLED rezervacija čiji zapis ostaje RELEASE_PENDING duže od 48h.
  async checkReleasePending(): Promise<void> {
    const stuck = await this.registrations.findReleasePendingOlderThan(48);
    for (const registration of stuck) {
      await this.eventBus.emit('M11', 'travel_guarantee_release_pending', {
        travelGuaranteeRegistrationId: registration.id,
        bookingId: registration.bookingId,
      });
    }
  }
}
