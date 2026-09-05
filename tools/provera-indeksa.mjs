#!/usr/bin/env node
/**
 * Provera: svaki strani ključ mora imati indeks.
 *
 * ZAŠTO POSTOJI (5.9.2026, dok. 39 nalaz 2.1): PostgreSQL NE pravi indeks na koloni koja
 * pokazuje na drugu tabelu — pravi ga samo na strani na koju se pokazuje. Bez njega svaki JOIN
 * po tom ključu i svaka provera pri brisanju roditelja čitaju CELU tabelu. Zatečeno je 81 takav
 * ključ od 102. Ispravljeno migracijom, ali ništa nije sprečavalo da se vrati: svaka nova
 * relacija u `schema.prisma` bez `@@index` pravi isti problem, a nikakav test to ne primećuje.
 *
 * Ova provera je zato **prepreka, ne podsetnik** — pada u CI čim se pojavi neindeksiran ključ.
 *
 * VAŽNO: provera poredi kolone stranog ključa sa PREFIKSOM svakog indeksa nad istom tabelom, ne
 * sa tačnim poklapanjem — kolona koja je vodeći stubac složenog indeksa je već pokrivena i ne
 * traži sopstveni indeks. Bez toga bi provera tražila suvišne indekse.
 *
 * POKRETANJE:  DATABASE_URL=... node tools/provera-indeksa.mjs
 */
import { PrismaClient } from '@prisma/client';

const UPIT = `
WITH fk AS (
  SELECT c.conrelid::regclass::text AS tbl, c.conname,
         (SELECT array_agg(a.attname ORDER BY x.ord)
            FROM unnest(c.conkey) WITH ORDINALITY x(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum) AS cols
  FROM pg_constraint c
  WHERE c.contype = 'f'
), idx AS (
  SELECT i.indrelid::regclass::text AS tbl,
         (SELECT array_agg(a.attname ORDER BY x.ord)
            FROM unnest(i.indkey::int[]) WITH ORDINALITY x(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = x.attnum) AS cols
  FROM pg_index i
)
SELECT fk.tbl, fk.conname, array_to_string(fk.cols, ', ') AS cols
FROM fk
WHERE NOT EXISTS (
  SELECT 1 FROM idx
  WHERE idx.tbl = fk.tbl AND idx.cols[1:array_length(fk.cols, 1)] = fk.cols
)
ORDER BY fk.tbl, fk.conname
`;

const prisma = new PrismaClient();
try {
  const bez = await prisma.$queryRawUnsafe(UPIT);
  const [{ ukupno }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS ukupno FROM pg_constraint WHERE contype = 'f'`,
  );

  if (bez.length === 0) {
    console.log(`Provera indeksa na stranim ključevima: svih ${ukupno} ima indeks.`);
    process.exit(0);
  }

  console.error(`Provera indeksa na stranim ključevima — ${bez.length} od ${ukupno} BEZ indeksa:\n`);
  for (const r of bez) console.error(`  ${r.tbl} (${r.cols})`);
  console.error('\nPostgres ne pravi ove indekse sam. Bez njih svaki JOIN po tom ključu i svaka');
  console.error('provera pri brisanju roditelja čitaju celu tabelu (dok. 39 nalaz 2.1).');
  console.error('Rešenje: dodati `@@index([polje])` u odgovarajući model u `schema.prisma`,');
  console.error('pa napraviti migraciju.');
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
