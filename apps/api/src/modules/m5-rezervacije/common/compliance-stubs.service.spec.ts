import { ComplianceStubsService } from './compliance-stubs.service';

// M5 spec §4 korak 1 — ovi testovi dokumentuju da su M11/M7 provere trenutno no-op
// (nijedan modul još ne postoji), i da to ostaje eksplicitno vidljivo dok se ne zameni
// stvarnim pozivom.
describe('ComplianceStubsService (M11/M7 stub, čeka implementaciju tih modula)', () => {
  const service = new ComplianceStubsService();

  it('garancija putovanja (M11) trenutno uvek prolazi', async () => {
    await expect(service.checkTravelGuaranteeUtilization({ bookingTotalPrice: 1_000_000, currency: 'EUR' })).resolves.toEqual({
      allowed: true,
    });
  });

  it('kreditni limit (M7) trenutno uvek prijavljuje "nije subagent"', async () => {
    await expect(
      service.checkCreditLimitIfSubagent({ clientAccountId: 'x', additionalAmount: 1000, currency: 'EUR' }),
    ).resolves.toEqual({ isSubagent: false, allowed: true });
  });

  it('subagent-unutar-kredita izuzetak vaučera (M7 §6.3) trenutno uvek vraća false', async () => {
    await expect(service.isActiveSubagentWithinCreditLimit('x')).resolves.toBe(false);
  });
});
