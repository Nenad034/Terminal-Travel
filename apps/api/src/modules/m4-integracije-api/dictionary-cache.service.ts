import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60_000; // 24h (M4 spec §2.4/§9 — polazna pretpostavka)

/**
 * M4 spec §2.4 — "Keširanje šifarnika po provajderu." Sirovi rečnici provajdera
 * (države, gradovi, tipovi soba...), odvojeno od M2 lenjog keširanja NormalizedContent.
 * In-memory je dovoljno za jedan proces (monolit) — ako se sistem kasnije podeli na
 * više procesa, ovo prelazi na deljeni keš (Redis), ista granica pomenuta u Master
 * dokumentu poglavlje 6 za Event Bus.
 */
@Injectable()
export class DictionaryCacheService {
  private readonly store = new Map<string, CacheEntry>();

  private key(providerCode: string, dictionaryName: string): string {
    return `${providerCode}:${dictionaryName}`;
  }

  get<T>(providerCode: string, dictionaryName: string): T | undefined {
    const entry = this.store.get(this.key(providerCode, dictionaryName));
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(this.key(providerCode, dictionaryName));
      return undefined;
    }
    return entry.value as T;
  }

  set(providerCode: string, dictionaryName: string, value: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
    this.store.set(this.key(providerCode, dictionaryName), { value, expiresAt: Date.now() + ttlMs });
  }

  /** Vraća keširanu vrednost ako postoji, inače poziva `fetcher` i keš je popunjava. */
  async getOrFetch<T>(
    providerCode: string,
    dictionaryName: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<T> {
    const cached = this.get<T>(providerCode, dictionaryName);
    if (cached !== undefined) return cached;
    const fresh = await fetcher();
    this.set(providerCode, dictionaryName, fresh, ttlMs);
    return fresh;
  }

  clear(providerCode: string, dictionaryName: string): void {
    this.store.delete(this.key(providerCode, dictionaryName));
  }
}
