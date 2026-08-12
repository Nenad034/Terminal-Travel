import { ComplianceStubsService } from './compliance-stubs.service';

// M5 spec §4 korak 1 — M11 provera garancije putovanja je od avgusta 2026 stvarna (in-process
// poziv ka TravelGuaranteeService), testirano ovde kroz mock istog obrasca kao ostali M5
// servisi koji zovu susedne module. M7 (B2B) i dalje ne postoji — taj deo ostaje no-op stub.
describe('ComplianceStubsService (M5 spec §4 korak 1)', () => {
  function makeService() {
    const travelGuarantee = { assessForBooking: jest.fn() };
    const service = new ComplianceStubsService(travelGuarantee as any);
    return { service, travelGuarantee };
  }

  it('garancija putovanja (M11) — prosleđuje rezultat TravelGuaranteeService.assessForBooking', async () => {
    const { service, travelGuarantee } = makeService();
    travelGuarantee.assessForBooking.mockResolvedValue({ allowed: false, reason: 'test-razlog' });

    const result = await service.checkTravelGuaranteeUtilization({ bookingTotalPrice: 1_000_000, currency: 'EUR' });

    expect(travelGuarantee.assessForBooking).toHaveBeenCalledWith({ bookingTotalPrice: 1_000_000, currency: 'EUR' });
    expect(result).toEqual({ allowed: false, reason: 'test-razlog' });
  });

  it('kreditni limit (M7) trenutno uvek prijavljuje "nije subagent"', async () => {
    const { service } = makeService();
    await expect(
      service.checkCreditLimitIfSubagent({ clientAccountId: 'x', additionalAmount: 1000, currency: 'EUR' }),
    ).resolves.toEqual({ isSubagent: false, allowed: true });
  });

  it('subagent-unutar-kredita izuzetak vaučera (M7 §6.3) trenutno uvek vraća false', async () => {
    const { service } = makeService();
    await expect(service.isActiveSubagentWithinCreditLimit('x')).resolves.toBe(false);
  });
});
