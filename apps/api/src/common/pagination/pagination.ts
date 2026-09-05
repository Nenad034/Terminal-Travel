import { BadRequestException } from '@nestjs/common';

/**
 * Zajedničko straničenje za sve liste (5.9.2026, dok. 39 nalaz 2.2).
 *
 * ZAŠTO POSTOJI: do danas u celom `apps/api` nije bilo nijedne pojave `skip:` ni `cursor:` —
 * svaka lista je vraćala SVE redove, osim devet mesta sa golim `take: 200`. To nije bilo
 * straničenje nego **tiho odsecanje**: agencija sa 201 rezervacijom ne bi videla najstariju,
 * i ništa na ekranu ne bi reklo da nešto nedostaje. Katalog nije imao ni to — kad se uključi
 * API dobavljač (M4), to su desetine hiljada zapisa u jednom odgovoru.
 *
 * OBLIK ODGOVORA je namerno `{ data, total, ... }` umesto golog niza: bez `total` ekran ne može
 * da kaže „prikazano 50 od 1.240", a upravo je nemogućnost da se to kaže bila jezgro nalaza.
 *
 * GRANICA: `limit` je tvrdo ograničen na `MAX_PAGE_SIZE`. Bez toga bi `?limit=1000000` bio
 * način da bilo ko sruši bazu jednim zahtevom — ista klasa problema koju straničenje i rešava.
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/**
 * Straničenje se čita kao DVA POJEDINAČNA `@Query` parametra, ne kao `@Query() dto`.
 *
 * NAUČENO NA GREŠCI (5.9.2026, isti dan): prvo je ovde stajao `PaginationQueryDto` sa
 * `class-validator` dekoratorima i kontroleri su ga primali preko `@Query() pagination: Dto`.
 * Globalni `ValidationPipe` radi sa `forbidNonWhitelisted`, pa je tada CEO query string
 * validiran protiv TOG dtoa — i svaki drugi parametar (`status`, `buyerName`, `stayFrom`...)
 * je počeo da vraća `400 property status should not exist`. Time bi svi filteri liste
 * rezervacija prestali da rade. `tsc` i 997 testova to nisu uhvatili; uhvatio je tek poziv
 * pravog endpointa (zamka 5.13). Zato: pojedinačni parametri i ručna provera ispod.
 */
export interface PaginationQueryDto {
  page?: number;
  limit?: number;
}

/**
 * Pretvara sirove `?page=`/`?limit=` u brojeve. Neispravna vrednost se ODBIJA, ne ćutke
 * popravlja — tiho sečenje je tačno ono što je i bio nalaz 2.2.
 */
export function parsePagination(page?: string, limit?: string): PaginationQueryDto {
  const out: PaginationQueryDto = {};
  if (page !== undefined && page !== '') {
    const n = Number(page);
    if (!Number.isInteger(n) || n < 1) throw new BadRequestException('`page` mora biti ceo broj veći od 0.');
    out.page = n;
  }
  if (limit !== undefined && limit !== '') {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1) throw new BadRequestException('`limit` mora biti ceo broj veći od 0.');
    if (n > MAX_PAGE_SIZE) throw new BadRequestException(`\`limit\` ne sme biti veći od ${MAX_PAGE_SIZE}.`);
    out.limit = n;
  }
  return out;
}

export interface Paginated<T> {
  data: T[];
  /** STVARAN broj redova koji odgovaraju filteru — ne broj vraćenih. */
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  hasMore: boolean;
}

/** Prevodi `page`/`limit` u Prisma `skip`/`take`. Jedno mesto, da se ne računa u svakom servisu. */
export function paginationArgs(query?: PaginationQueryDto): { skip: number; take: number; page: number; limit: number } {
  const page = Math.max(1, Math.trunc(query?.page ?? 1));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(query?.limit ?? DEFAULT_PAGE_SIZE)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function paginated<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return { data, total, page, limit, pageCount, hasMore: page < pageCount };
}
