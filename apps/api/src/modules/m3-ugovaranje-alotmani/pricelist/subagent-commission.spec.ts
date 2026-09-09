import { Izuzetak, nadjiIzuzetak, obracunajProviziju } from './subagent-commission';

/**
 * M3 §2.11i — provizija subagenta po pojedinačnoj stavci.
 *
 * Osnovica je prodajna (bruto) cena — vlasnikova odluka 9.9.2026. Testovi to i fiksiraju:
 * ako se osnovica ikad promeni na nabavnu ili na maržu, ovi brojevi padaju i to je namerno.
 */
describe('subagent-commission (M3 §2.11i)', () => {
  const OSNOVA: Izuzetak = {
    subagentId: null,
    scopeType: 'M3_CONTRACT',
    scopeId: 'c1',
    noCommission: false,
    percentage: null,
    fixedAmount: null,
    activeFrom: null,
    activeTo: null,
  };

  const K = {
    subagentId: 'sub1',
    rateLineId: 'rl1',
    ancillaryServiceId: null,
    contractPeriodId: 'p1',
    seasonId: 's1',
    contractId: 'c1',
    naDan: new Date('2026-11-01T00:00:00Z'),
  };

  describe('nadjiIzuzetak — najuži domet pobeđuje', () => {
    it('pravilo na cenovnoj stavci pobeđuje pravilo na ugovoru', () => {
      const naStavci = {
        ...OSNOVA,
        scopeType: 'M3_RATE_LINE' as const,
        scopeId: 'rl1',
        percentage: 5,
      };
      const naUgovoru = { ...OSNOVA, percentage: 8 };
      expect(nadjiIzuzetak([naUgovoru, naStavci], K)?.percentage).toBe(5);
    });

    it('pravilo na periodu pobeđuje pravilo na sezoni', () => {
      const naPeriodu = {
        ...OSNOVA,
        scopeType: 'M3_CONTRACT_PERIOD' as const,
        scopeId: 'p1',
        percentage: 6,
      };
      const naSezoni = { ...OSNOVA, scopeType: 'M3_SEASON' as const, scopeId: 's1', percentage: 7 };
      expect(nadjiIzuzetak([naSezoni, naPeriodu], K)?.percentage).toBe(6);
    });

    it('nivo koji se za ovu stavku ne zna se preskače, ne obara pretragu', () => {
      // Doplata nema `rateLineId`; pravilo na ugovoru mora i dalje da se nađe.
      const naUgovoru = { ...OSNOVA, percentage: 8 };
      const doplata = { ...K, rateLineId: null, ancillaryServiceId: 'a1' };
      expect(nadjiIzuzetak([naUgovoru], doplata)?.percentage).toBe(8);
    });

    it('vraća null kad nijedno pravilo ne pokriva stavku', () => {
      expect(nadjiIzuzetak([], K)).toBeNull();
    });
  });

  describe('nadjiIzuzetak — pojedinačan subagent pobeđuje opšte pravilo', () => {
    it('dogovor sa ovim subagentom nadjačava pravilo koje važi za sve', () => {
      const zaSve = { ...OSNOVA, subagentId: null, percentage: 8 };
      const zaNjega = { ...OSNOVA, subagentId: 'sub1', percentage: 12 };
      expect(nadjiIzuzetak([zaSve, zaNjega], K)?.percentage).toBe(12);
    });

    it('pravilo za DRUGOG subagenta se ne primenjuje na ovog', () => {
      const zaDrugog = { ...OSNOVA, subagentId: 'sub2', percentage: 12 };
      const zaSve = { ...OSNOVA, subagentId: null, percentage: 8 };
      expect(nadjiIzuzetak([zaDrugog, zaSve], K)?.percentage).toBe(8);
    });
  });

  describe('nadjiIzuzetak — vremensko važenje', () => {
    it('pravilo koje je isteklo se ne primenjuje', () => {
      const isteklo = { ...OSNOVA, percentage: 5, activeTo: new Date('2026-06-30T00:00:00Z') };
      expect(nadjiIzuzetak([isteklo], K)).toBeNull();
    });

    it('pravilo koje još nije počelo se ne primenjuje', () => {
      const buduce = { ...OSNOVA, percentage: 5, activeFrom: new Date('2027-01-01T00:00:00Z') };
      expect(nadjiIzuzetak([buduce], K)).toBeNull();
    });

    it('granica važenja je uključena', () => {
      const naGranici = { ...OSNOVA, percentage: 5, activeTo: new Date('2026-11-01T00:00:00Z') };
      expect(nadjiIzuzetak([naGranici], K)?.percentage).toBe(5);
    });
  });

  describe('obracunajProviziju — osnovica je BRUTO (prodajna) cena', () => {
    it('bez izuzetka koristi podrazumevanu stopu subagenta', () => {
      // 120,00 prodajna, 10% → 12,00. Ovo je i primer iz vlasnikovog nalaza.
      expect(obracunajProviziju(12_000, 10, null)).toEqual({
        iznos: 1_200,
        izvor: 'SUBAGENT_DEFAULT',
        bezProvizije: false,
      });
    });

    it('izuzetak sa procentom nadjačava podrazumevanu stopu', () => {
      const r = obracunajProviziju(12_000, 10, { ...OSNOVA, percentage: 5 });
      expect(r.iznos).toBe(600);
      expect(r.izvor).toBe('M3_CONTRACT');
    });

    it('procenat i fiksan iznos se SABIRAJU — isto pravilo kao kod marže', () => {
      // 5% od 120,00 = 6,00, plus 2,00 = 8,00
      expect(
        obracunajProviziju(12_000, 10, { ...OSNOVA, percentage: 5, fixedAmount: 200 }).iznos,
      ).toBe(800);
    });

    it('sam fiksan iznos radi bez procenta', () => {
      expect(obracunajProviziju(12_000, 10, { ...OSNOVA, fixedAmount: 1_000 }).iznos).toBe(1_000);
    });

    it('„bez provizije" daje nulu i to se vidi kao izričita odluka, ne kao prazno polje', () => {
      const r = obracunajProviziju(12_000, 10, { ...OSNOVA, noCommission: true });
      expect(r.iznos).toBe(0);
      expect(r.bezProvizije).toBe(true);
      expect(r.izvor).toBe('M3_CONTRACT');
    });

    it('„bez provizije" nadjačava i popunjen procenat na istom pravilu', () => {
      expect(
        obracunajProviziju(12_000, 10, { ...OSNOVA, noCommission: true, percentage: 20 }).iznos,
      ).toBe(0);
    });

    it('izuzetak bez ijedne vrednosti pada na podrazumevanu stopu, ne na nulu', () => {
      const r = obracunajProviziju(12_000, 10, OSNOVA);
      expect(r.iznos).toBe(1_200);
      expect(r.izvor).toBe('SUBAGENT_DEFAULT');
    });

    it('subagent bez podrazumevane stope dobija nulu, ne pad', () => {
      expect(obracunajProviziju(12_000, null, null).iznos).toBe(0);
    });

    it('zaokružuje na najmanju jedinicu valute, bez decimala', () => {
      // 7% od 12.345 = 864,15 → 864
      expect(obracunajProviziju(12_345, 7, null).iznos).toBe(864);
    });
  });
});
