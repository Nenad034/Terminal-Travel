import { Injectable } from '@nestjs/common';
import { ProviderConfig } from '@prisma/client';
import { decryptSecret } from '../../common/crypto/secret-box';
import { DictionaryCacheService } from './dictionary-cache.service';
import { ProviderAdapter } from './provider-adapter.interface';
import { ApiKeyStrategy } from './auth-strategies/api-key.strategy';
import { BasicAuthStrategy } from './auth-strategies/basic.strategy';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { TravelgateAdapter } from './adapters/travelgate.adapter';
import { SolvexAdapter } from './adapters/solvex.adapter';
import { WebHotelierAdapter } from './adapters/webhotelier.adapter';

interface TravelgateAuthConfig {
  endpoint: string;
  apiKey: string;
}

interface SolvexAuthConfig {
  endpoint: string;
  login: string;
  password: string;
}

interface WebHotelierAuthConfig {
  endpoint: string;
  username: string;
  password: string;
}

/**
 * M4 spec §2/§9 — bira konkretan `ProviderAdapter` za dati `ProviderConfig`. Kad je
 * `useMock = true` (§9, formalizacija otvorenog pitanja o mock/test režimu), uvek vraća
 * `MockProviderAdapter`, bez obzira na `provider_code` — omogućava testiranje circuit
 * breaker-a/idempotency-ja/degradacije bez gađanja pravog spoljnog servera.
 */
@Injectable()
export class ProviderRegistryService {
  constructor(private readonly dictionaryCache: DictionaryCacheService) {}

  /**
   * Instanca po `provider_code` se kešira i ponovo koristi (ne pravi se nova na svaki
   * poziv) — bitno je ne samo radi performansi, nego i ISPRAVNOSTI: `SESSION_TOKEN`
   * (Solvex GUID) i `OAUTH2_CLIENT_CREDENTIALS` strategije čuvaju token unutar same
   * instance adaptera (§2.2) — bez keširanja instance, svaki poziv bi iznova logovao
   * umesto da ponovo iskoristi već važeći token.
   */
  private readonly adapterCache = new Map<string, ProviderAdapter>();

  getAdapter(config: ProviderConfig): ProviderAdapter {
    const cached = this.adapterCache.get(config.providerCode);
    if (cached) return cached;

    const adapter = this.buildAdapter(config);
    this.adapterCache.set(config.providerCode, adapter);
    return adapter;
  }

  /** Poziva se posle izmene ProviderConfig-a (kredencijali, useMock...) da sledeći getAdapter() napravi svežu instancu. */
  invalidate(providerCode: string): void {
    this.adapterCache.delete(providerCode);
  }

  private buildAdapter(config: ProviderConfig): ProviderAdapter {
    if (config.useMock) {
      return new MockProviderAdapter(config.providerCode, config.category);
    }

    const timeoutMs = Math.max(config.timeoutSearchMs, config.timeoutBookingMs);
    const authConfig = JSON.parse(decryptSecret(config.authConfigEncrypted)) as Record<string, unknown>;

    switch (config.providerCode) {
      case 'travelgate': {
        const cfg = authConfig as unknown as TravelgateAuthConfig;
        return new TravelgateAdapter(config.providerCode, cfg.endpoint, new ApiKeyStrategy(cfg.apiKey, 'TGX-Auth-API-Key'), timeoutMs);
      }
      case 'solvex': {
        const cfg = authConfig as unknown as SolvexAuthConfig;
        return new SolvexAdapter(config.providerCode, cfg.endpoint, cfg.login, cfg.password, timeoutMs, this.dictionaryCache);
      }
      case 'webhotelier': {
        const cfg = authConfig as unknown as WebHotelierAuthConfig;
        return new WebHotelierAdapter(config.providerCode, cfg.endpoint, new BasicAuthStrategy(cfg.username, cfg.password), timeoutMs);
      }
      default:
        throw new Error(`Nema registrovanog adaptera za provider_code=${config.providerCode} (M4 spec §9)`);
    }
  }
}
