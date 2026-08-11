import { DictionaryCacheService } from './dictionary-cache.service';

describe('DictionaryCacheService (M4 spec §2.4 — šifarnici po provajderu, TTL)', () => {
  it('vraća undefined kad ništa nije keširano', () => {
    const cache = new DictionaryCacheService();
    expect(cache.get('travelgate', 'countries')).toBeUndefined();
  });

  it('vraća keširanu vrednost pre isteka TTL-a', () => {
    const cache = new DictionaryCacheService();
    cache.set('travelgate', 'countries', ['RS', 'HR'], 60_000);
    expect(cache.get('travelgate', 'countries')).toEqual(['RS', 'HR']);
  });

  it('vraća undefined posle isteka TTL-a', () => {
    const cache = new DictionaryCacheService();
    cache.set('travelgate', 'countries', ['RS'], -1); // već istekao
    expect(cache.get('travelgate', 'countries')).toBeUndefined();
  });

  it('razdvaja keš po provajderu — isti naziv šifarnika, različit provider_code', () => {
    const cache = new DictionaryCacheService();
    cache.set('travelgate', 'countries', ['RS'], 60_000);
    cache.set('solvex', 'countries', ['BG'], 60_000);
    expect(cache.get('travelgate', 'countries')).toEqual(['RS']);
    expect(cache.get('solvex', 'countries')).toEqual(['BG']);
  });

  describe('getOrFetch', () => {
    it('poziva fetcher samo jednom za dva uzastopna poziva u istom TTL prozoru (izlazni kriterijum M4 §8)', async () => {
      const cache = new DictionaryCacheService();
      const fetcher = jest.fn().mockResolvedValue(['RS', 'HR']);

      const first = await cache.getOrFetch('travelgate', 'countries', fetcher);
      const second = await cache.getOrFetch('travelgate', 'countries', fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(first).toEqual(['RS', 'HR']);
      expect(second).toEqual(['RS', 'HR']);
    });

    it('poziva fetcher ponovo posle isteka TTL-a', async () => {
      const cache = new DictionaryCacheService();
      const fetcher = jest.fn().mockResolvedValue(['RS']);

      await cache.getOrFetch('travelgate', 'countries', fetcher, -1);
      await cache.getOrFetch('travelgate', 'countries', fetcher, -1);

      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear', () => {
    it('uklanja keširanu vrednost za dati provider/šifarnik', () => {
      const cache = new DictionaryCacheService();
      cache.set('travelgate', 'countries', ['RS'], 60_000);
      cache.clear('travelgate', 'countries');
      expect(cache.get('travelgate', 'countries')).toBeUndefined();
    });
  });
});
