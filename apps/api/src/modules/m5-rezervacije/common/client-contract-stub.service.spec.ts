import { ClientContractStubService } from './client-contract-stub.service';

// M5 spec §6 dopuna (M20 §3.3) — od avgusta 2026 stvaran in-process poziv ka
// ClientContractsService, testirano ovde kroz mock istog obrasca kao ComplianceStubsService.
describe('ClientContractStubService (M5 spec §6 dopuna, M20 §3.3)', () => {
  it('prosleđuje rezultat ClientContractsService.hasGeneratedContract', async () => {
    const clientContracts = { hasGeneratedContract: jest.fn().mockResolvedValue(true) };
    const service = new ClientContractStubService(clientContracts as any);

    const result = await service.hasGeneratedContract('booking-1');

    expect(clientContracts.hasGeneratedContract).toHaveBeenCalledWith('booking-1');
    expect(result).toBe(true);
  });
});
