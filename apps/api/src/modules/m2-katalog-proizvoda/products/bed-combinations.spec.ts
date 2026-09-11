import {
  BedCombinationOverride,
  izvediMatricu,
  kljucKombinacije,
  odstupanjaVanMatrice,
  primeniOdstupanja,
} from './bed-combinations';

const kljucevi = (
  beds: { base_beds?: number | null; extra_beds_max?: number | null },
  min?: number,
) => izvediMatricu(beds, min).map((r) => r.key);

describe('M2 §2.3g — izvedena matrica kombinacija', () => {
  // Izlazni kriterijum §8 doslovno: "soba sa 2 osnovna + 1 pomoćnim krevetom daje redove
  // 3A_0C, 2A_1C, 1A_2C, sa prikazom ko na kom krevetu leži; odrasli pune osnovne krevete pre
  // pomoćnih."
  it('soba 2+1 daje redove iz izlaznog kriterijuma, tim redom', () => {
    const svi = kljucevi({ base_beds: 2, extra_beds_max: 1 });
    expect(svi.filter((k) => k.startsWith('3A') || k === '2A_1C' || k === '1A_2C')).toEqual([
      '3A_0C',
      '2A_1C',
      '1A_2C',
    ]);
  });

  it('nabraja svaki ukupan broj osoba od 1 do zbira kreveta', () => {
    expect(kljucevi({ base_beds: 2, extra_beds_max: 1 })).toEqual([
      '1A_0C',
      '2A_0C',
      '1A_1C',
      '3A_0C',
      '2A_1C',
      '1A_2C',
    ]);
  });

  // Kriterijum za sobu 2+1 ne navodi `0A_3C` iako "sve podele" doslovno čitano uključuje i njega.
  it('nijedan red nema nula odraslih', () => {
    for (const beds of [
      { base_beds: 1, extra_beds_max: 0 },
      { base_beds: 2, extra_beds_max: 1 },
      { base_beds: 4, extra_beds_max: 2 },
    ]) {
      expect(izvediMatricu(beds).every((r) => r.odraslih >= 1)).toBe(true);
    }
  });

  it('odrasli pune osnovne krevete pre pomoćnih', () => {
    const red = izvediMatricu({ base_beds: 2, extra_beds_max: 1 }).find((r) => r.key === '2A_1C');
    expect(red?.raspored).toEqual([
      { krevet: 'OSNOVNI', ko: 'ODRASLA' },
      { krevet: 'OSNOVNI', ko: 'ODRASLA' },
      { krevet: 'POMOCNI', ko: 'DETE' },
    ]);
  });

  it('deca zauzimaju ono što preostane, osnovne krevete pre pomoćnih', () => {
    const red = izvediMatricu({ base_beds: 2, extra_beds_max: 1 }).find((r) => r.key === '1A_2C');
    expect(red?.raspored).toEqual([
      { krevet: 'OSNOVNI', ko: 'ODRASLA' },
      { krevet: 'OSNOVNI', ko: 'DETE' },
      { krevet: 'POMOCNI', ko: 'DETE' },
    ]);
    expect(red?.decaNaPomocnom).toBe(1);
  });

  it('decaNaPomocnom je 0 kad sva deca staju u osnovne krevete', () => {
    const red = izvediMatricu({ base_beds: 3, extra_beds_max: 1 }).find((r) => r.key === '1A_2C');
    expect(red?.decaNaPomocnom).toBe(0);
  });

  it('min_occupancy izbacuje redove ispod donje granice', () => {
    expect(kljucevi({ base_beds: 2, extra_beds_max: 1 }, 2)).toEqual([
      '2A_0C',
      '1A_1C',
      '3A_0C',
      '2A_1C',
      '1A_2C',
    ]);
  });

  it('min_occupancy veći od broja kreveta ne izbriše celu matricu', () => {
    // Nesaglasan unos (min_occupancy 5 u sobi sa 2 kreveta) ne sme da da praznu tabelu koja
    // izgleda kao "soba ništa ne prima" — svede se na puno zauzeće.
    expect(kljucevi({ base_beds: 2, extra_beds_max: 0 }, 5)).toEqual(['2A_0C', '1A_1C']);
  });

  it('soba bez unetih kreveta daje praznu matricu', () => {
    expect(izvediMatricu({ base_beds: 0, extra_beds_max: 0 })).toEqual([]);
    expect(izvediMatricu(null)).toEqual([]);
    expect(izvediMatricu(undefined)).toEqual([]);
  });

  it('extra_beds_max null/undefined znači da soba ne prima pomoćne krevete', () => {
    expect(kljucevi({ base_beds: 2, extra_beds_max: null })).toEqual(['1A_0C', '2A_0C', '1A_1C']);
    expect(kljucevi({ base_beds: 2 })).toEqual(['1A_0C', '2A_0C', '1A_1C']);
  });

  it('besmislene vrednosti se svode, ne ruše', () => {
    expect(izvediMatricu({ base_beds: -3, extra_beds_max: -1 })).toEqual([]);
    expect(kljucevi({ base_beds: 2.7, extra_beds_max: 0 })).toEqual(['1A_0C', '2A_0C', '1A_1C']);
  });

  // Izlazni kriterijum §8: "Matrica ne sadrži nijednu kategoriju iz cenovnika (CHD1/CHD2…) —
  // ista soba daje istu matricu bez obzira koliko dečjih kategorija ima cenovnik koji je gleda."
  // Ovde se to dokazuje najjače što se može: `izvediMatricu` uopšte NE PRIMA uzrasnu politiku,
  // pa je nema odakle pročitati. Test stoji da bi svaki budući pokušaj da se `age_policy` ubaci
  // u potpis pao ovde, a ne tek u prodaji.
  it('matrica ne zavisi ni od jedne uzrasne kategorije', () => {
    const beds = { base_beds: 2, extra_beds_max: 1 };
    const saJednomKategorijom = izvediMatricu(beds);
    const saTriKategorije = izvediMatricu(beds);
    expect(saJednomKategorijom).toEqual(saTriKategorije);
    expect(izvediMatricu.length).toBe(2); // (beds, minOccupancy) — nema trećeg parametra
    expect(JSON.stringify(saJednomKategorijom)).not.toMatch(/CHD|ADL|INF|ADULT|CHILD|INFANT/);
  });

  it('kljucKombinacije je oblik iz specifikacije', () => {
    expect(kljucKombinacije(1, 2)).toBe('1A_2C');
    expect(kljucKombinacije(3, 0)).toBe('3A_0C');
  });
});

describe('M2 §2.3g — odstupanja', () => {
  const beds = { base_beds: 2, extra_beds_max: 1 };

  it('prazan niz znači sve dozvoljeno, nikad nijedna', () => {
    const redovi = primeniOdstupanja(izvediMatricu(beds), []);
    expect(redovi.length).toBe(6);
    expect(redovi.every((r) => r.allowed)).toBe(true);
    expect(redovi.every((r) => !r.imaOdstupanje)).toBe(true);
  });

  it('null i undefined se ponašaju isto kao prazan niz', () => {
    expect(primeniOdstupanja(izvediMatricu(beds), null).every((r) => r.allowed)).toBe(true);
    expect(primeniOdstupanja(izvediMatricu(beds), undefined).every((r) => r.allowed)).toBe(true);
  });

  it('zabrana pada samo na svoj red', () => {
    const redovi = primeniOdstupanja(izvediMatricu(beds), [{ key: '1A_2C', allowed: false }]);
    expect(redovi.find((r) => r.key === '1A_2C')?.allowed).toBe(false);
    expect(redovi.filter((r) => r.key !== '1A_2C').every((r) => r.allowed)).toBe(true);
  });

  it('shared_bed_children i note stižu do reda', () => {
    const redovi = primeniOdstupanja(izvediMatricu(beds), [
      { key: '2A_1C', shared_bed_children: 1, note: 'beba u krevetu roditelja' },
    ]);
    const red = redovi.find((r) => r.key === '2A_1C');
    expect(red?.shared_bed_children).toBe(1);
    expect(red?.note).toBe('beba u krevetu roditelja');
    expect(red?.imaOdstupanje).toBe(true);
  });

  it('zapis koji se posle smanjenja kreveta više ne izvodi se PRIJAVLJUJE, ne briše', () => {
    const odstupanja: BedCombinationOverride[] = [
      { key: '1A_2C', allowed: false },
      { key: '4A_0C', allowed: false },
    ];
    const matrica = izvediMatricu({ base_beds: 2, extra_beds_max: 1 });

    expect(odstupanjaVanMatrice(matrica, odstupanja).map((o) => o.key)).toEqual(['4A_0C']);
    // ...i ignoriše se u obračunu: nijedan red matrice ga ne nosi.
    expect(primeniOdstupanja(matrica, odstupanja).some((r) => r.key === '4A_0C')).toBe(false);
    // ...ali zapis i dalje postoji, pa ponovo postaje tačan čim se kreveti vrate.
    expect(
      odstupanjaVanMatrice(izvediMatricu({ base_beds: 3, extra_beds_max: 1 }), odstupanja),
    ).toEqual([]);
  });

  it('nema odstupanja van matrice kad ih nema uopšte', () => {
    expect(odstupanjaVanMatrice(izvediMatricu(beds), [])).toEqual([]);
    expect(odstupanjaVanMatrice(izvediMatricu(beds), null)).toEqual([]);
  });
});
