import { Prisma, ProductType } from '@prisma/client';

/**
 * M3 spec §6 (dopuna v1.24) — filteri „kroz proizvode": destinacija, naziv objekta i vrsta
 * proizvoda, primenjeni na ekranima Dobavljači i Ugovori.
 *
 * ZAŠTO KROZ PROIZVODE, a ne nad samim redom (vlasnikova odluka 9.9.2026, na pitanje šta ta
 * polja tamo znače): dobavljač u bazi ima SVOJU državu — sedište firme — a ne destinaciju, i
 * nema ni mesto ni hotel. Filter „Grčka" nad spiskom dobavljača zato ne znači „dobavljači sa
 * sedištem u Grčkoj" nego „dobavljači koji nam nešto prodaju u Grčkoj", što je jedino pitanje
 * koje se u prodaji zaista postavlja. Isto važi za ugovore.
 *
 * Čitanje `Product` (M2) iz M3 prati konvenciju koja u ovom repozitorijumu već postoji —
 * `CapacityService.grid` na isti način čita naziv i destinaciju objekta, uz obrazloženje „M2 se
 * čita preko svog modela, bez dupliranja podatka". Podatak se ne kopira u M3, samo se pita.
 */
export interface ProductScopeFilters {
  destinationCountry?: string;
  destinationCity?: string;
  /** Naziv objekta (srpski prevod iz M2). */
  productName?: string;
  productType?: ProductType[];
}

/**
 * Query parametar koji sme da se ponovi (`?productType=A&productType=B`) stiže kao `string[]`,
 * jedan kao `string`. Nepoznata vrednost se **ćuti** umesto da obori ceo poziv na 400: ovo su
 * filteri liste, a ne unos podataka — pogrešan parametar u adresi ne sme da ostavi korisnika
 * pred porukom o grešci umesto pred spiskom.
 */
export function toProductTypes(v: string | string[] | undefined): ProductType[] | undefined {
  if (!v) return undefined;
  const svi = Object.values(ProductType) as string[];
  const out = (Array.isArray(v) ? v : [v]).filter((t) => svi.includes(t)) as ProductType[];
  return out.length > 0 ? out : undefined;
}

export function hasProductScope(f: ProductScopeFilters | undefined): boolean {
  return Boolean(
    f && (f.destinationCountry || f.destinationCity || f.productName || f.productType?.length),
  );
}

/**
 * Uslov nad jednim `Product` redom. Vraća `undefined` kad nijedan filter nije postavljen — to
 * je razlika između „ne sužavaj" i „suzi na sve", koju prazan objekat gubi.
 */
export function productWhere(
  f: ProductScopeFilters | undefined,
): Prisma.ProductWhereInput | undefined {
  if (!hasProductScope(f)) return undefined;
  return {
    type: f!.productType?.length ? { in: f!.productType } : undefined,
    destinationCountry: f!.destinationCountry
      ? { contains: f!.destinationCountry, mode: 'insensitive' }
      : undefined,
    destinationCity: f!.destinationCity
      ? { contains: f!.destinationCity, mode: 'insensitive' }
      : undefined,
    translations: f!.productName
      ? { some: { name: { contains: f!.productName, mode: 'insensitive' } } }
      : undefined,
  };
}

/** Ugovor koji ima BAR JEDAN proizvod koji odgovara filterima. */
export function contractProductScope(
  f: ProductScopeFilters | undefined,
): Prisma.ContractWhereInput {
  const where = productWhere(f);
  return where ? { products: { some: where } } : {};
}

/**
 * Dobavljač koji nam nešto prodaje pod tim uslovima. Dva puta do proizvoda, i oba se broje:
 * kroz ugovor (`Contract.products`) i direktno (`Supplier.manualProducts` — ručno uneta usluga
 * bez ugovora, M2 §2.1). Da se gledao samo prvi, dobavljač sa isključivo ručnim uslugama bi
 * tiho nestao sa spiska čim se postavi bilo koji filter.
 */
export function supplierProductScope(
  f: ProductScopeFilters | undefined,
): Prisma.SupplierWhereInput {
  const where = productWhere(f);
  if (!where) return {};
  return {
    OR: [
      { contracts: { some: { products: { some: where } } } },
      { manualProducts: { some: where } },
    ],
  };
}
