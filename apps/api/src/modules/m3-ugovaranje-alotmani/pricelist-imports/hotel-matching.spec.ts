import {
  PRAG_AUTOMATSKOG_POKLAPANJA,
  levenshtein,
  nadjiNajbolji,
  normalizujNaziv,
  slicnost,
} from './hotel-matching';

/**
 * M3 spec §4.2.3 / §4.2.6 — poklapanje hotela iz cenovnika sa katalogom.
 *
 * Ovo je jedini deo uvoza koji odlučuje NA KOJI HOTEL ide cena, i namerno ga radi kod a ne
 * model. Testovi zato gađaju upravo to: da su parovi koje čovek vidi kao isti objekat iznad
 * praga, a parovi koje vidi kao različite ispod njega.
 */
describe('hotel-matching (M3 §4.2.3)', () => {
  describe('normalizujNaziv', () => {
    it('sklanja dijakritiku, velika slova i reči koje ne razlikuju objekte', () => {
      expect(normalizujNaziv('Hotel Splendid 5*')).toBe('splendid');
      expect(normalizujNaziv('SPLENDID resort')).toBe('splendid');
      expect(normalizujNaziv('Vila Đerdap')).toBe('derdap');
    });

    it('ne pretvara različite objekte u isti niz', () => {
      expect(normalizujNaziv('Hotel Avala')).not.toBe(normalizujNaziv('Hotel Budva'));
    });
  });

  describe('slicnost', () => {
    it('isti objekat napisan drugačije prelazi prag automatskog poklapanja', () => {
      expect(slicnost('Hotel Splendid 5*', 'Splendid')).toBeGreaterThanOrEqual(
        PRAG_AUTOMATSKOG_POKLAPANJA,
      );
      expect(slicnost('SPLENDID RESORT', 'Hotel Splendid')).toBeGreaterThanOrEqual(
        PRAG_AUTOMATSKOG_POKLAPANJA,
      );
    });

    it('različiti objekti ostaju ispod praga — cena na pogrešnom hotelu je skupa greška', () => {
      expect(slicnost('Hotel Avala', 'Hotel Budva')).toBeLessThan(PRAG_AUTOMATSKOG_POKLAPANJA);
      expect(slicnost('Splendid', 'Slavija')).toBeLessThan(PRAG_AUTOMATSKOG_POKLAPANJA);
    });

    it('prazan naziv nikad ne poklapa', () => {
      expect(slicnost('', 'Splendid')).toBe(0);
      expect(slicnost('Hotel', 'Splendid')).toBe(0); // ostaje prazno posle normalizacije
    });

    it('jedno slovo razlike u dugom nazivu ne obara poklapanje', () => {
      expect(slicnost('Aegean Breeze Resort', 'Aegean Breze Resort')).toBeGreaterThanOrEqual(
        PRAG_AUTOMATSKOG_POKLAPANJA,
      );
    });
  });

  describe('levenshtein', () => {
    it('meri broj izmena, ne sličnost na oko', () => {
      expect(levenshtein('kotor', 'kotor')).toBe(0);
      expect(levenshtein('kotor', 'kotar')).toBe(1);
      expect(levenshtein('', 'budva')).toBe(5);
    });
  });

  describe('nadjiNajbolji', () => {
    const kandidati = [
      {
        id: 'p1',
        destinationCity: 'Budva',
        destinationCountry: 'Crna Gora',
        naziv: 'Hotel Splendid',
      },
      { id: 'p2', destinationCity: 'Budva', destinationCountry: 'Crna Gora', naziv: 'Hotel Avala' },
      {
        id: 'p3',
        destinationCity: 'Kotor',
        destinationCountry: 'Crna Gora',
        naziv: 'Splendid Palace',
      },
    ];

    it('bira najbliži naziv i vraća ocenu', () => {
      const r = nadjiNajbolji('SPLENDID 5*', kandidati)!;
      expect(r.kandidat.id).toBe('p1');
      expect(r.ocena).toBeGreaterThanOrEqual(PRAG_AUTOMATSKOG_POKLAPANJA);
    });

    it('sužava po mestu kad je destinacija poznata — istoimeni hotel u drugom gradu nije isti', () => {
      const r = nadjiNajbolji('Splendid Palace', kandidati, { city: 'Kotor' })!;
      expect(r.kandidat.id).toBe('p3');
    });

    it('kad sužavanje po mestu ne ostavi nikoga, gleda ceo katalog', () => {
      // Bolje predlog uz nižu ocenu nego nijedan, samo zato što je mesto drugačije napisano.
      const r = nadjiNajbolji('Splendid', kandidati, { city: 'Nepostojeće' })!;
      expect(r.kandidat.id).toBe('p1');
    });

    it('vraća i kandidata ISPOD praga, sa ocenom — ekran mora da pokaže šta je bilo najbliže', () => {
      const r = nadjiNajbolji('Zlatibor Konak', kandidati)!;
      expect(r).not.toBeNull();
      expect(r.ocena).toBeLessThan(PRAG_AUTOMATSKOG_POKLAPANJA);
    });

    it('prazan katalog daje null, ne izmišljen predlog', () => {
      expect(nadjiNajbolji('Splendid', [])).toBeNull();
    });
  });
});
