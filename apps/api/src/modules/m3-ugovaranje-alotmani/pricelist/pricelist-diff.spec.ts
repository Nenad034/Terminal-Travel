import { kljucCene, kljucDoplate, SnapshotRed, uporedi } from './pricelist-diff';

/**
 * M3 §2.11l — nova verzija ne briše staru, čovek potvrđuje samo razlike.
 */
describe('pricelist-diff (M3 §2.11l)', () => {
  const cena = (opis: string, kljuc: string, vrednost: number, detalji?: any): SnapshotRed => ({
    vrsta: 'CENA',
    kljuc,
    opis,
    vrednost,
    detalji,
  });

  describe('kljucCene — ista stavka u dve verzije se prepoznaje', () => {
    const osnova = {
      roomType: 'STD',
      seasonCode: '1',
      boardType: 'BB',
      occupancy: '2ADT',
      priceBasis: 'PER_ROOM_PER_NIGHT',
    };

    it('promena cene ne menja ključ — inače bi izmena izgledala kao brisanje pa dodavanje', () => {
      expect(kljucCene(osnova)).toBe(kljucCene({ ...osnova }));
    });

    it('vikend cena je druga stavka jer nosi druge dane', () => {
      expect(kljucCene({ ...osnova, validWeekdays: [5, 6] })).not.toBe(
        kljucCene({ ...osnova, validWeekdays: [7, 1, 2, 3, 4] }),
      );
    });

    it('prazan niz dana i nenavedeni dani su ista stavka — prazno znači „svi dani"', () => {
      expect(kljucCene({ ...osnova, validWeekdays: [] })).toBe(kljucCene(osnova));
    });

    it('redosled dana ne pravi novu stavku', () => {
      expect(kljucCene({ ...osnova, validWeekdays: [6, 5] })).toBe(
        kljucCene({ ...osnova, validWeekdays: [5, 6] }),
      );
    });
  });

  describe('kljucDoplate — poredi se po imenu i dometu, ne po id-u zapisa', () => {
    it('ista doplata iz novog dokumenta se prepoznaje iako je nov zapis', () => {
      const a = { name: 'Boravišna taksa', kind: 'SURCHARGE', seasonCode: null };
      const b = { name: '  boravišna taksa ', kind: 'SURCHARGE', seasonCode: null };
      expect(kljucDoplate(a)).toBe(kljucDoplate(b));
    });

    it('isti naziv sa drugim uzrasnim opsegom je druga stavka (Aycon taksa ima tri stepena)', () => {
      const odrasli = {
        name: 'Taksa',
        kind: 'SURCHARGE',
        seasonCode: null,
        ageFrom: 18,
        ageTo: null,
      };
      const deca = { name: 'Taksa', kind: 'SURCHARGE', seasonCode: null, ageFrom: 0, ageTo: 11.99 };
      expect(kljucDoplate(odrasli)).not.toBe(kljucDoplate(deca));
    });
  });

  describe('uporedi — tri vrste razlike', () => {
    const stara: SnapshotRed[] = [
      cena('Studio · sezona 1 · BB · 2ADT', 'k1', 10000),
      cena('Studio · sezona 2 · BB · 2ADT', 'k2', 12000),
      cena('Apartman · sezona 1 · BB · 4ADT', 'k3', 20000),
    ];

    it('izmenjena cena se prikazuje kao stara → nova, u novcu a ne u centima', () => {
      const nova = [cena('Studio · sezona 1 · BB · 2ADT', 'k1', 11000), stara[1], stara[2]];
      const r = uporedi(stara, nova);
      expect(r).toHaveLength(1);
      expect(r[0].vrsta).toBe('IZMENJENA');
      expect(r[0].poruka).toContain('100,00 → 110,00');
      expect(r[0].staraVrednost).toBe(10000);
      expect(r[0].novaVrednost).toBe(11000);
    });

    it('nepromenjeni redovi se NE prijavljuju — u tome je cela poenta', () => {
      expect(uporedi(stara, [...stara])).toEqual([]);
    });

    it('nova stavka i ugašena stavka se razlikuju od izmene', () => {
      const nova = [stara[0], stara[1], cena('Studio · sezona 3 · BB · 2ADT', 'k4', 9000)];
      const r = uporedi(stara, nova);
      expect(r.map((x) => x.vrsta).sort()).toEqual(['NOVA', 'UGASENA']);
      expect(r.find((x) => x.vrsta === 'UGASENA')!.poruka).toContain('Apartman');
    });

    it('izmene idu pre novih i ugašenih — cena je najosetljiviji slučaj', () => {
      const nova = [
        cena('Studio · sezona 1 · BB · 2ADT', 'k1', 11000),
        stara[1],
        cena('X', 'k9', 100),
      ];
      expect(uporedi(stara, nova).map((x) => x.vrsta)).toEqual(['IZMENJENA', 'NOVA', 'UGASENA']);
    });

    it('promena roka prodaje je izmena i kad cena ostane ista', () => {
      const s = [cena('Studio', 'k1', 10000, { 'prodaja do': '2026-12-31' })];
      const n = [cena('Studio', 'k1', 10000, { 'prodaja do': '2027-01-15' })];
      const r = uporedi(s, n);
      expect(r).toHaveLength(1);
      expect(r[0].izmenjenaPolja).toEqual([
        { polje: 'prodaja do', staro: '2026-12-31', novo: '2027-01-15' },
      ]);
    });

    it('uklonjen rok prodaje je izmena — „oduvek bez roka" nije isto što i „rok obrisan"', () => {
      const s = [cena('Studio', 'k1', 10000, { 'prodaja do': '2026-12-31' })];
      const n = [cena('Studio', 'k1', 10000, {})];
      expect(uporedi(s, n)[0].izmenjenaPolja[0].novo).toBeNull();
    });

    it('prva verzija (nema stare) prijavljuje sve kao nove stavke', () => {
      expect(uporedi([], stara).every((r) => r.vrsta === 'NOVA')).toBe(true);
    });
  });
});
