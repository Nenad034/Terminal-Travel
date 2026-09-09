import { danUtc, opseziSeSeku, proveriSezonu } from './season-ranges';

/**
 * M3 §2.11b — sezona je kolona cenovnika i sme imati više datumskih opsega.
 *
 * Testovi gađaju jedno pitanje: da li jedan datum pripada tačno jednoj koloni. Primeri su
 * uzeti iz stvarnog cenovnika (Aycon 2026), ne izmišljeni — sezona 1 tamo doslovno pokriva
 * i proleće i oktobar.
 */
describe('season-ranges (M3 §2.11b)', () => {
  const AYCON_1 = {
    code: '1',
    ranges: [
      { dateFrom: '2026-04-01', dateTo: '2026-05-31' },
      { dateFrom: '2026-10-01', dateTo: '2026-10-31' },
    ],
  };
  const AYCON_5 = { code: '5', ranges: [{ dateFrom: '2026-07-19', dateTo: '2026-08-24' }] };

  describe('danUtc', () => {
    it('gleda dan, ne trenutak — vreme u ulazu ne pomera datum', () => {
      expect(danUtc('2026-07-19')).toBe(danUtc(new Date('2026-07-19T23:59:00Z')));
    });
  });

  describe('opseziSeSeku', () => {
    it('dodirivanje na granici je preklapanje — isti dan ne sme u dve kolone', () => {
      expect(
        opseziSeSeku(
          { dateFrom: '2026-06-01', dateTo: '2026-06-30' },
          { dateFrom: '2026-06-30', dateTo: '2026-07-10' },
        ),
      ).toBe(true);
    });

    it('susedni dani se ne seku', () => {
      expect(
        opseziSeSeku(
          { dateFrom: '2026-06-01', dateTo: '2026-06-30' },
          { dateFrom: '2026-07-01', dateTo: '2026-07-10' },
        ),
      ).toBe(false);
    });
  });

  describe('proveriSezonu', () => {
    it('prihvata sezonu sa dva odvojena dela godine — to je stvarni slučaj, ne izuzetak', () => {
      expect(proveriSezonu(AYCON_1, [AYCON_5])).toBeNull();
    });

    it('odbija sezonu bez ijednog opsega', () => {
      expect(proveriSezonu({ code: '2', ranges: [] }, [])?.poruka).toMatch(/bar jedan/);
    });

    it('odbija opseg koji počinje posle svog kraja', () => {
      const r = proveriSezonu(
        { code: '2', ranges: [{ dateFrom: '2026-08-01', dateTo: '2026-07-01' }] },
        [],
      );
      expect(r?.poruka).toMatch(/počinje posle svog kraja/);
    });

    it('odbija preklapanje unutar iste sezone', () => {
      const r = proveriSezonu(
        {
          code: '1',
          ranges: [
            { dateFrom: '2026-04-01', dateTo: '2026-05-31' },
            { dateFrom: '2026-05-15', dateTo: '2026-06-10' },
          ],
        },
        [],
      );
      expect(r?.poruka).toMatch(/unutar iste sezone/);
    });

    it('odbija preklapanje sa drugom sezonom i imenuje je — poruka mora reći GDE je sudar', () => {
      const r = proveriSezonu(
        { code: '4', ranges: [{ dateFrom: '2026-08-01', dateTo: '2026-08-05' }] },
        [AYCON_5],
      );
      expect(r?.poruka).toContain('„5"');
    });

    it('izmena sezone ne pada na preklapanju sa samom sobom', () => {
      // Pozivalac izuzima sezonu koja se menja; ovaj test to pravilo fiksira.
      expect(proveriSezonu(AYCON_1, [])).toBeNull();
    });
  });
});
