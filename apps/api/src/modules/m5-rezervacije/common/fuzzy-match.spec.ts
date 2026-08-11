import { levenshteinDistance, namesMatch, normalizeName, similarity } from './fuzzy-match';

describe('normalizeName (M5 spec §6.4)', () => {
  it('uklanja dijakritike i normalizuje velika/mala slova', () => {
    expect(normalizeName('Đorđe ČAĐAVIĆ')).toBe('dorde cadavic');
  });

  it('sažima višestruke razmake', () => {
    expect(normalizeName('  Marko   Marković  ')).toBe('marko markovic');
  });
});

describe('levenshteinDistance', () => {
  it('vraća 0 za identične stringove', () => {
    expect(levenshteinDistance('marko', 'marko')).toBe(0);
  });

  it('računa broj izmena', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('similarity', () => {
  it('vraća 1 za identična imena nakon normalizacije', () => {
    expect(similarity('Miloš', 'milos')).toBe(1);
  });

  it('vraća nižu vrednost za različita imena', () => {
    expect(similarity('Petar', 'Ana')).toBeLessThan(0.5);
  });
});

describe('namesMatch (M5 spec §6.4 — deterministički fuzzy-match)', () => {
  it('poklapa isto ime uprkos tipfeleru', () => {
    expect(namesMatch('Petar', 'Petrović', 'Petar', 'Petovic')).toBe(true);
  });

  it('ne poklapa različita imena', () => {
    expect(namesMatch('Petar', 'Petrović', 'Ana', 'Jovanović')).toBe(false);
  });

  it('poklapa isto ime uprkos dijakriticima/velikim-malim slovima', () => {
    expect(namesMatch('Đorđe', 'Nikolić', 'đorđe', 'NIKOLIC')).toBe(true);
  });
});
