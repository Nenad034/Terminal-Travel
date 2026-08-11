import { encryptSecret } from '../../common/crypto/secret-box';
import { DictionaryCacheService } from './dictionary-cache.service';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { TravelgateAdapter } from './adapters/travelgate.adapter';
import { SolvexAdapter } from './adapters/solvex.adapter';
import { ProviderRegistryService } from './provider-registry.service';

describe('ProviderRegistryService (M4 spec §2/§9 — use_mock formalizacija)', () => {
  const ORIGINAL_ENV = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-not-for-production';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL_ENV;
  });

  function makeRegistry() {
    return new ProviderRegistryService(new DictionaryCacheService());
  }

  it('vraća MockProviderAdapter kad je useMock=true, bez obzira na provider_code', () => {
    const registry = makeRegistry();
    const adapter = registry.getAdapter({
      providerCode: 'travelgate',
      category: 'HOTEL',
      useMock: true,
      authConfigEncrypted: '',
      timeoutSearchMs: 8000,
      timeoutBookingMs: 15000,
      capabilitiesProfile: {},
    } as any);

    expect(adapter).toBeInstanceOf(MockProviderAdapter);
  });

  it('vraća TravelgateAdapter za provider_code=travelgate kad useMock=false', () => {
    const registry = makeRegistry();
    const authConfig = encryptSecret(JSON.stringify({ endpoint: 'https://api.travelgate.com/', apiKey: 'kljuc' }));
    const adapter = registry.getAdapter({
      providerCode: 'travelgate',
      category: 'HOTEL',
      useMock: false,
      authConfigEncrypted: authConfig,
      timeoutSearchMs: 8000,
      timeoutBookingMs: 15000,
      capabilitiesProfile: {},
    } as any);

    expect(adapter).toBeInstanceOf(TravelgateAdapter);
  });

  it('vraća SolvexAdapter za provider_code=solvex kad useMock=false', () => {
    const registry = makeRegistry();
    const authConfig = encryptSecret(
      JSON.stringify({ endpoint: 'https://evaluation.solvex.bg/iservice/integrationservice.asmx', login: 'sol611s', password: 'x' }),
    );
    const adapter = registry.getAdapter({
      providerCode: 'solvex',
      category: 'HOTEL',
      useMock: false,
      authConfigEncrypted: authConfig,
      timeoutSearchMs: 8000,
      timeoutBookingMs: 15000,
      capabilitiesProfile: {},
    } as any);

    expect(adapter).toBeInstanceOf(SolvexAdapter);
  });

  it('baca grešku za nepoznat provider_code', () => {
    const registry = makeRegistry();
    const authConfig = encryptSecret(JSON.stringify({ endpoint: 'https://x.com' }));
    expect(() =>
      registry.getAdapter({
        providerCode: 'nepoznat',
        category: 'HOTEL',
        useMock: false,
        authConfigEncrypted: authConfig,
        timeoutSearchMs: 8000,
        timeoutBookingMs: 15000,
        capabilitiesProfile: {},
      } as any),
    ).toThrow();
  });
});
