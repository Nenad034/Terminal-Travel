#!/usr/bin/env node
/**
 * Provera: fajl sa `'use server'` sme da izvozi ISKLJUČIVO `async` funkcije.
 *
 * ZAŠTO POSTOJI (5.9.2026): ekran „Najave dobavljačima" je prijavljen kao gotov, a u browseru
 * je rušio ceo prikaz — `A "use server" file can only export async functions, found object`.
 * Iz `actions.ts` je bila izvezena obična konstanta (`export const emptyState = {...}`).
 * `tsc` to ne prijavljuje, `next build` ne prijavljuje, testovi ne prijavljuju; greška živi
 * isključivo u browseru. Vidi zamku 7.1a u `33-ZAMKE-I-OBAVEZNE-PROVERE.md`.
 *
 * Ovo je namerno GLUPA provera nad tekstom, ne pravi parser — traži `export` koji nije
 * `async function` u fajlu koji počinje sa `'use server'`. Cilj nije pokriti svaki mogući
 * oblik, nego da tačno ova greška više ne prođe nezapaženo do browsera.
 *
 * POKRETANJE:  node tools/provera-use-server.mjs        (izlazi 1 ako nešto padne)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const KORENI = ['apps/panel/src', 'apps/web/src'];
const NASTAVCI = ['.ts', '.tsx'];

/** `export const x`, `export let/var`, `export default <nešto što nije async function>`, `export { ... }`. */
const SUMNJIVI = [
  { re: /^export\s+(const|let|var)\s+(\w+)/, opis: (m) => `\`export ${m[1]} ${m[2]}\` — vrednost, ne async funkcija` },
  { re: /^export\s+default\s+(?!async\s+function)/, opis: () => '`export default` koji nije `async function`' },
  { re: /^export\s+function\s+(\w+)/, opis: (m) => `\`export function ${m[1]}\` — nije \`async\`` },
  { re: /^export\s+class\s+(\w+)/, opis: (m) => `\`export class ${m[1]}\`` },
];

function sviFajlovi(dir) {
  const out = [];
  for (const ime of readdirSync(dir)) {
    const put = join(dir, ime);
    if (statSync(put).isDirectory()) {
      if (ime === 'node_modules' || ime === '.next') continue;
      out.push(...sviFajlovi(put));
    } else if (NASTAVCI.some((n) => ime.endsWith(n))) {
      out.push(put);
    }
  }
  return out;
}

const nalazi = [];
for (const koren of KORENI) {
  let fajlovi;
  try {
    fajlovi = sviFajlovi(koren);
  } catch {
    continue; // aplikacija ne postoji u ovoj radnoj kopiji
  }
  for (const put of fajlovi) {
    const sadrzaj = readFileSync(put, 'utf8');
    // Direktiva mora biti na vrhu fajla (prve neprazne linije), inače ne važi za ceo modul.
    const vrh = sadrzaj.split('\n').slice(0, 5).join('\n');
    if (!/^\s*['"]use server['"]/m.test(vrh)) continue;

    sadrzaj.split('\n').forEach((linija, i) => {
      const t = linija.trim();
      // `export type` / `export interface` nestaju pri kompajliranju — ne stižu do runtime-a.
      if (/^export\s+(type|interface)\b/.test(t)) return;
      if (/^export\s+async\s+function\b/.test(t)) return;
      for (const { re, opis } of SUMNJIVI) {
        const m = t.match(re);
        if (m) {
          nalazi.push({ fajl: relative(process.cwd(), put).replace(/\\/g, '/'), linija: i + 1, poruka: opis(m) });
          break;
        }
      }
    });
  }
}

if (nalazi.length === 0) {
  console.log("Provera `'use server'` izvoza: sve u redu.");
  process.exit(0);
}

console.error(`Provera \`'use server'\` izvoza — ${nalazi.length} problem(a):\n`);
for (const n of nalazi) {
  console.error(`  ${n.fajl}:${n.linija}  ${n.poruka}`);
}
console.error(
  '\nFajl sa `\'use server\'` sme da izvozi samo `async` funkcije — sve ostalo ruši ceo ekran u',
);
console.error('browseru, a ni `tsc` ni `next build` to ne prijavljuju (zamka 7.1a).');
console.error('Rešenje: konstante i tipove premestiti u susedni `types.ts` BEZ te direktive.');
process.exit(1);
