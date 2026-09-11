import {
  KatalogSoba,
  normalizujTipSobe,
  poklopiTipSobe,
  poklopiTipoveSoba,
} from './room-type-match';

/**
 * M3 §2.11m — most između dobavljačevog teksta i šifre sobe iz kataloga.
 *
 * Merilo je nalaz od 10.9.2026: uvoz je upisivao „Studio A2", katalog nosi šifru `3584729001`,
 * pa se u prodaji nije poklapalo nikad i provera kapaciteta se tiho isključivala (zamka 7.14).
 */
describe('room-type-match (M3 §2.11m)', () => {
  const katalog: KatalogSoba[] = [
    { code: '3584729001', name: 'Studio A2' },
    { code: '3584729002', name: 'Studio A3' },
    { code: '3584729003', name: 'Deluxe soba sa pogledom na more' },
    { code: '3584729004', name: 'Porodični apartman' },
  ];

  describe('normalizacija', () => {
    it('cifra se ČUVA — po njoj se sobe i razlikuju', () => {
      expect(normalizujTipSobe('Studio A2')).toBe('studio a2');
      expect(normalizujTipSobe('Studio A3')).toBe('studio a3');
      expect(normalizujTipSobe('Studio A2')).not.toBe(normalizujTipSobe('Studio A3'));
    });

    it('naša slova i interpunkcija ne prave razliku', () => {
      expect(normalizujTipSobe('Porodični  apartman!')).toBe('porodicni apartman');
      expect(normalizujTipSobe('DVOKREVETNA-SOBA')).toBe('dvokrevetna soba');
    });

    it('đ ostaje slovo, ne nestaje', () => {
      expect(normalizujTipSobe('Đardin')).toBe('dardin');
    });
  });

  describe('poklapanje', () => {
    it('tekst koji je već šifra iz kataloga se prepoznaje kao šifra', () => {
      expect(poklopiTipSobe('3584729001', katalog)).toEqual({
        code: '3584729001',
        nacin: 'SIFRA',
      });
    });

    it('pun naziv iz dokumenta daje šifru te sobe', () => {
      expect(poklopiTipSobe('studio a2', katalog)).toEqual({
        code: '3584729001',
        nacin: 'NAZIV',
      });
    });

    it('naziv sa drugačijim slovima i razmacima i dalje pogađa', () => {
      expect(poklopiTipSobe('  Deluxe   soba sa pogledom na more ', katalog)).toEqual({
        code: '3584729003',
        nacin: 'NAZIV',
      });
    });

    it('deo naziva prolazi SAMO kad pogađa tačno jednu sobu', () => {
      expect(poklopiTipSobe('Porodični', katalog)).toEqual({
        code: '3584729004',
        nacin: 'DEO_NAZIVA',
      });
    });

    it('dvosmislen deo naziva se NE pogađa — ide čoveku', () => {
      // „Studio" odgovara i A2 i A3 — sistem radije prijavi nego pretpostavi (§2.4a princip).
      expect(poklopiTipSobe('Studio', katalog)).toBeNull();
    });

    it('tekst koji katalog uopšte ne poznaje vraća null', () => {
      expect(poklopiTipSobe('Predsednički apartman', katalog)).toBeNull();
    });

    it('prazan tekst nije poklapanje', () => {
      expect(poklopiTipSobe('   ', katalog)).toBeNull();
      expect(poklopiTipSobe('', katalog)).toBeNull();
    });

    it('prazan katalog ne poklapa ništa — soba se prvo unosi u katalog', () => {
      expect(poklopiTipSobe('Studio A2', [])).toBeNull();
    });

    it('dva ista naziva u katalogu su dvosmislena, ne prvo pronađeno', () => {
      const dupli: KatalogSoba[] = [
        { code: 'A', name: 'Studio' },
        { code: 'B', name: 'Studio' },
      ];
      expect(poklopiTipSobe('Studio', dupli)).toBeNull();
    });

    it('šifra pobeđuje naziv kad bi oba mogla da pogode', () => {
      // Soba čija je ŠIFRA jednaka nazivu druge sobe — jači stepen mora da pobedi.
      const zbunjujuci: KatalogSoba[] = [
        { code: 'STUDIO', name: 'Apartman uz baštu' },
        { code: '99', name: 'Studio' },
      ];
      expect(poklopiTipSobe('studio', zbunjujuci)).toEqual({ code: 'STUDIO', nacin: 'SIFRA' });
    });
  });

  describe('ceo spisak odjednom', () => {
    it('isti tekst se poklapa jednom, bez obzira koliko redova ga nosi', () => {
      const r = poklopiTipoveSoba(['Studio A2', 'Studio A2', 'Studio A3'], katalog);
      expect(r.mapa.size).toBe(2);
      expect(r.mapa.get('Studio A2')!.code).toBe('3584729001');
      expect(r.nepoklopljeni).toEqual([]);
    });

    it('nepoklopljeni se prijavljuju, ne ćute se', () => {
      const r = poklopiTipoveSoba(['Studio A2', 'Predsednički apartman', 'Studio'], katalog);
      expect(r.mapa.size).toBe(1);
      expect(r.nepoklopljeni).toEqual(['Predsednički apartman', 'Studio']);
    });

    it('prazni tekstovi se preskaču, ne postaju nepoklopljena stavka', () => {
      const r = poklopiTipoveSoba(['', '   ', 'Studio A2'], katalog);
      expect(r.nepoklopljeni).toEqual([]);
      expect(r.mapa.size).toBe(1);
    });
  });
});
