import { MockCisGatewayAdapter } from './mock-cis-gateway.adapter';

describe('MockCisGatewayAdapter (M11 spec §2.3, §7)', () => {
  it('register vraća sintetički cisRegistrationNumber koji sadrži booking_number', async () => {
    const adapter = new MockCisGatewayAdapter();

    const result = await adapter.register({
      bookingId: 'booking-1',
      bookingNumber: 'TT-2026-001',
      travelGuaranteeId: 'tg-1',
      policyNumber: 'P-1',
    });

    expect(result.cisRegistrationNumber).toContain('TT-2026-001');
  });

  it('release ne baca grešku (mock potvrđuje skidanje opterećenja)', async () => {
    const adapter = new MockCisGatewayAdapter();
    await expect(adapter.release({ cisRegistrationNumber: 'CIS-1' })).resolves.toBeUndefined();
  });
});
