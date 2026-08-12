import { M11AlarmsService } from './m11-alarms.service';

describe('M11AlarmsService (M11 spec §2.1, §2.2, §2.3)', () => {
  function makeService() {
    const eventBus = { emit: jest.fn() };
    const travelGuarantee = { checkAndEmitHealthSignals: jest.fn() };
    const registrations = { findMissingRegistrationOlderThan: jest.fn(), findReleasePendingOlderThan: jest.fn() };
    const service = new M11AlarmsService(eventBus as any, travelGuarantee as any, registrations as any);
    return { service, eventBus, travelGuarantee, registrations };
  }

  it('runDailyChecks pokreće sve tri provere', async () => {
    const { service, travelGuarantee, registrations } = makeService();
    registrations.findMissingRegistrationOlderThan.mockResolvedValue([]);
    registrations.findReleasePendingOlderThan.mockResolvedValue([]);

    await service.runDailyChecks();

    expect(travelGuarantee.checkAndEmitHealthSignals).toHaveBeenCalled();
    expect(registrations.findMissingRegistrationOlderThan).toHaveBeenCalledWith(48);
    expect(registrations.findReleasePendingOlderThan).toHaveBeenCalledWith(48);
  });

  it('checkMissingRegistrations emituje alarm za svaki nedostajući zapis (§2.3 alarm 1)', async () => {
    const { service, eventBus, registrations } = makeService();
    registrations.findMissingRegistrationOlderThan.mockResolvedValue([{ id: 'reg-1', bookingId: 'booking-1' }]);

    await service.checkMissingRegistrations();

    expect(eventBus.emit).toHaveBeenCalledWith('M11', 'travel_guarantee_registration_missing', {
      travelGuaranteeRegistrationId: 'reg-1',
      bookingId: 'booking-1',
    });
  });

  it('checkReleasePending emituje alarm za svaki zaglavljen zapis (§2.3 alarm 2)', async () => {
    const { service, eventBus, registrations } = makeService();
    registrations.findReleasePendingOlderThan.mockResolvedValue([{ id: 'reg-2', bookingId: 'booking-2' }]);

    await service.checkReleasePending();

    expect(eventBus.emit).toHaveBeenCalledWith('M11', 'travel_guarantee_release_pending', {
      travelGuaranteeRegistrationId: 'reg-2',
      bookingId: 'booking-2',
    });
  });
});
