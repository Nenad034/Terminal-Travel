import { ComplianceBridgeService } from './compliance-bridge.service';

// M5 spec §4 korak 1 — M11 (garancija putovanja) i M7 (kreditni limit subagenta) su od avgusta
// 2026 oba stvarna in-process pozivi ka svojim modulima (M11 direktno, M7 preko
// SubagentBridgeService, isti folder) — testirano ovde kroz mock istog obrasca kao ostali M5
// servisi koji zovu susedne module (SubagentBridgeService sam ima svoje jedinične testove).
describe('ComplianceBridgeService (M5 spec §4 korak 1)', () => {
  function makeService() {
    const travelGuarantee = { assessForBooking: jest.fn() };
    const subagentBridge = { checkCreditLimitIfSubagent: jest.fn(), isActiveSubagentWithinCreditLimit: jest.fn() };
    const service = new ComplianceBridgeService(travelGuarantee as any, subagentBridge as any);
    return { service, travelGuarantee, subagentBridge };
  }

  it('garancija putovanja (M11) — prosleđuje rezultat TravelGuaranteeService.assessForBooking', async () => {
    const { service, travelGuarantee } = makeService();
    travelGuarantee.assessForBooking.mockResolvedValue({ allowed: false, reason: 'test-razlog' });

    const result = await service.checkTravelGuaranteeUtilization({ bookingTotalPrice: 1_000_000, currency: 'EUR' });

    expect(travelGuarantee.assessForBooking).toHaveBeenCalledWith({ bookingTotalPrice: 1_000_000, currency: 'EUR' });
    expect(result).toEqual({ allowed: false, reason: 'test-razlog' });
  });

  it('kreditni limit (M7) — prosleđuje rezultat SubagentBridgeService.checkCreditLimitIfSubagent', async () => {
    const { service, subagentBridge } = makeService();
    subagentBridge.checkCreditLimitIfSubagent.mockResolvedValue({ isSubagent: true, allowed: false, withinCreditLimit: false });

    const result = await service.checkCreditLimitIfSubagent({ clientAccountId: 'x', additionalAmount: 1000, currency: 'EUR' });

    expect(subagentBridge.checkCreditLimitIfSubagent).toHaveBeenCalledWith({ clientAccountId: 'x', additionalAmount: 1000, currency: 'EUR' });
    expect(result).toEqual({ isSubagent: true, allowed: false, withinCreditLimit: false });
  });

  it('subagent-unutar-kredita izuzetak vaučera (M7 §6.3) — prosleđuje rezultat SubagentBridgeService', async () => {
    const { service, subagentBridge } = makeService();
    subagentBridge.isActiveSubagentWithinCreditLimit.mockResolvedValue(true);

    await expect(service.isActiveSubagentWithinCreditLimit('x')).resolves.toBe(true);
    expect(subagentBridge.isActiveSubagentWithinCreditLimit).toHaveBeenCalledWith('x');
  });
});
