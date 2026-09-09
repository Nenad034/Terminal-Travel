import {
  contractProductScope,
  hasProductScope,
  productWhere,
  supplierProductScope,
  toProductTypes,
} from './product-scope';

/**
 * M3 spec §6 (v1.24) — filteri „kroz proizvode" na listama dobavljača i ugovora.
 *
 * Ovo su čiste funkcije koje grade Prisma uslov, pa se testira tačno ono što u njima može tiho
 * da pođe naopako: razlika između „nema filtera" i „filter ne pogađa ništa", i to da dobavljač
 * sa isključivo ručno unetim uslugama (bez ijednog ugovora) ne ispadne sa spiska.
 */
describe('product-scope (M3 §6 v1.24)', () => {
  describe('toProductTypes', () => {
    it('prima i jednu vrednost i niz', () => {
      expect(toProductTypes('FLIGHT')).toEqual(['FLIGHT']);
      expect(toProductTypes(['FLIGHT', 'ACCOMMODATION'])).toEqual(['FLIGHT', 'ACCOMMODATION']);
    });

    it('ćuti nepoznatu vrednost umesto da obori poziv — ovo su filteri liste, ne unos', () => {
      expect(toProductTypes('IZMISLJENO')).toBeUndefined();
      expect(toProductTypes(['FLIGHT', 'IZMISLJENO'])).toEqual(['FLIGHT']);
    });

    it('prazan ulaz je „nema filtera", ne prazan niz', () => {
      expect(toProductTypes(undefined)).toBeUndefined();
      expect(toProductTypes([])).toBeUndefined();
    });
  });

  describe('productWhere', () => {
    it('bez ijednog filtera vraća undefined — „ne sužavaj", ne „suzi na sve"', () => {
      expect(hasProductScope(undefined)).toBe(false);
      expect(hasProductScope({})).toBe(false);
      expect(productWhere({})).toBeUndefined();
      expect(contractProductScope({})).toEqual({});
      expect(supplierProductScope({})).toEqual({});
    });

    it('tekstualna polja porede „sadrži", bez obzira na velika slova', () => {
      const w = productWhere({ destinationCity: 'budva', productName: 'splendid' })!;
      expect(w.destinationCity).toEqual({ contains: 'budva', mode: 'insensitive' });
      // Naziv objekta živi u prevodu, ne na samom proizvodu.
      expect(w.translations).toEqual({
        some: { name: { contains: 'splendid', mode: 'insensitive' } },
      });
    });

    it('polje koje nije zadato ostaje undefined, da ne uđe u Prisma uslov kao null', () => {
      const w = productWhere({ destinationCity: 'budva' })!;
      expect(w.destinationCountry).toBeUndefined();
      expect(w.type).toBeUndefined();
      expect(w.translations).toBeUndefined();
    });
  });

  describe('supplierProductScope', () => {
    it('traži proizvode i kroz ugovor i direktno — dobavljač sa samo ručnim uslugama ostaje', () => {
      const w = supplierProductScope({ destinationCountry: 'Grčka' });
      expect(w.OR).toHaveLength(2);
      // Da postoji samo prva grana, dobavljač bez ijednog ugovora bi tiho nestao sa spiska
      // čim se postavi bilo koji filter (M2 §2.1 — ručno uneta usluga nosi supplierId direktno).
      expect(w.OR?.[0]).toHaveProperty('contracts');
      expect(w.OR?.[1]).toHaveProperty('manualProducts');
    });
  });

  describe('contractProductScope', () => {
    it('ugovor ulazi u rezultat ako ima BAR JEDAN proizvod koji odgovara', () => {
      const w = contractProductScope({ productType: ['FLIGHT'] });
      expect(w.products).toEqual({ some: { type: { in: ['FLIGHT'] } } });
    });
  });
});
