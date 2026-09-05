import { BadRequestException } from '@nestjs/common';
import { MAX_PAGE_SIZE, paginated, paginationArgs, parsePagination } from './pagination';

// Dok. 39 nalaz 2.2 — straničenje.
//
// Zašto baš ovi testovi: greška koju zaključavaju nije pad nego TIHO ODSECANJE. Lista je vraćala
// 200 redova od 1.000 i niko to nije mogao da primeti. Takva greška se ne vidi u tipovima ni u
// izuzecima, samo u vrednostima — pa se mora proveriti računicom.
describe('Straničenje (dok. 39 nalaz 2.2)', () => {
  describe('parsePagination — neispravna vrednost se ODBIJA, ne ćutke popravlja', () => {
    it('bez parametara ne postavlja ništa (poziv bez straničenja ostaje moguć)', () => {
      expect(parsePagination(undefined, undefined)).toEqual({});
      expect(parsePagination('', '')).toEqual({});
    });

    it('prihvata ispravne vrednosti', () => {
      expect(parsePagination('3', '25')).toEqual({ page: 3, limit: 25 });
    });

    it('limit veći od dozvoljenog se ODBIJA, ne seče se tiho na 200', () => {
      // Ovo je jezgro nalaza: tiho svođenje na granicu je isto što i tiho odsecanje —
      // pozivalac misli da je dobio 1.000 redova, a dobio je 200.
      expect(() => parsePagination(undefined, '1000')).toThrow(BadRequestException);
      expect(() => parsePagination(undefined, String(MAX_PAGE_SIZE))).not.toThrow();
    });

    it('odbija nulu, negativne i necele brojeve', () => {
      for (const bad of ['0', '-1', '1.5', 'abc']) {
        expect(() => parsePagination(bad, undefined)).toThrow(BadRequestException);
        expect(() => parsePagination(undefined, bad)).toThrow(BadRequestException);
      }
    });
  });

  describe('paginationArgs — prevod u Prisma skip/take', () => {
    it('prva strana ne preskače ništa', () => {
      expect(paginationArgs({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20, page: 1, limit: 20 });
    });

    it('treća strana preskače tačno dve pune strane', () => {
      expect(paginationArgs({ page: 3, limit: 20 }).skip).toBe(40);
    });

    it('bez parametara koristi podrazumevanu veličinu strane', () => {
      expect(paginationArgs(undefined).take).toBe(50);
    });
  });

  describe('paginated — omotač odgovora', () => {
    it('računa broj strana i `hasMore` iz UKUPNOG broja, ne iz broja vraćenih redova', () => {
      const r = paginated([1, 2, 3], 25, 1, 10);
      expect(r.total).toBe(25);
      expect(r.pageCount).toBe(3);
      expect(r.hasMore).toBe(true);
    });

    it('poslednja strana nema `hasMore`', () => {
      expect(paginated([1], 21, 3, 10).hasMore).toBe(false);
    });

    it('prazan rezultat je jedna strana, ne nula (da ekran ne piše „strana 1 od 0")', () => {
      const r = paginated([], 0, 1, 50);
      expect(r.pageCount).toBe(1);
      expect(r.hasMore).toBe(false);
    });
  });
});
