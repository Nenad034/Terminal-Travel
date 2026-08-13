import { ComplianceStubsService } from './compliance-stubs.service';

// M5 spec §4 korak 1 — M11 (garancija putovanja) i M7 (kreditni limit subagenta) su od avgusta
// 2026 oba stvarna in-process pozivi ka svojim modulima (M11 direktno, M7 preko
// SubagentStubService, isti folder) — testirano ovde kroz mock istog obrasca kao ostali M5
// servisi koji zovu susedne module (SubagentStubService sam ima svoje jedinične testove).
describe('ComplianceStubsService (M5 spec §4 korak 1)', () => {
  function makeService() {
    const travelGuarantee = { assessForBooking: jest.fn() };
    const subagentStub = { checkCreditLimitIfSubagent: jest.fn(), isActiveSubagentWithinCreditLimit: jest.fn() };
    const service = new ComplianceStubsService(travelGuarantee as any, subagentStub as any);
    return { service, travelGuarantee, subagentStub };
  }

  it('garancija putovanja (M11) — prosleđuje rezultat TravelGuaranteeService.assessForBooking', async () => {
    const { service, travelGuarantee } = makeService();
    travelGuarantee.assessForBooking.mockResolvedValue({ allowed: false, reason: 'test-razlog' });

    const result = await service.checkTravelGuaranteeUtilization({ bookingTotalPrice: 1_000_000, currency: 'EUR' });

    expect(travelGuarantee.assessForBooking).toHaveBeenCalledWith({ bookingTotalPrice: 1_000_000, currency: 'EUR' });
    expect(result).toEqual({ allowed: false, reason: 'test-razlog' });
  });

  it('kreditni limit (M7) — prosleđuje rezultat SubagentStubService.checkCreditLimitIfSubagent', async () => {
    const { service, subagentStub } = makeService();
    subagentStub.checkCreditLimitIfSubagent.mockResolvedValue({ isSubagent: true, allowed: false, withinCreditLimit: false });

    const result = await service.checkCreditLimitIfSubagent({ clientAccountId: 'x', additionalAmount: 1000, currency: 'EUR' });

    expect(subagentStub.checkCreditLimitIfSubagent).toHaveBeenCalledWith({ clientAccountId: 'x', additionalAmount: 1000, currency: 'EUR' });
    expect(result).toEqual({ isSubagent: true, allowed: false, withinCreditLimit: false });
  });

  it('subagent-unutar-kredita izuzetak vaučera (M7 §6.3) — prosleđuje rezultat SubagentStubService', async () => {
    const { service, subagentStub } = makeService();
    subagentStub.isActiveSubagentWithinCreditLimit.mockResolvedValue(true);

    await expect(service.isActiveSubagentWithinCreditLimit('x')).resolves.toBe(true);
    expect(subagentStub.isActiveSubagentWithinCreditLimit).toHaveBeenCalledWith('x');
  });
});
