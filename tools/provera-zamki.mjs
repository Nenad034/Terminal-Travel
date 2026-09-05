// Proverava numeraciju registra zamki (`docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`):
//   1. nijedan broj ne sme nositi dva unosa,
//   2. svaki pokazivač oblika „zamka N.M" iz celog repozitorijuma mora voditi na postojeći unos.
//
// ZAŠTO POSTOJI (6.9.2026): do danas je osam brojeva nosilo po dva unosa, jer su dve sesije
// uporedo dopisivale dokument. Broj zamke je adresa na koju pokazuju drugi dokumenti i
// komentari u kodu — kad jedan broj vodi na dva mesta, pokazivač tiho gubi značenje. Uz to su
// četiri mesta godinama upućivala na broj koji nikad nije imao to značenje. Nijedna od te dve
// greške se ne vidi golim okom u dokumentu od sto unosa.
//
//   node tools/provera-zamki.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const DOK = 'docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md';
const tekst = readFileSync(DOK, 'utf8');
const telo = tekst.split('## 1. Boje')[1] ?? '';

const brojevi = [...telo.matchAll(/^\*\*(\d+\.\d+[a-z]?) /gm)].map((m) => m[1]);
const problemi = [];

const viden = new Map();
for (const b of brojevi) viden.set(b, (viden.get(b) ?? 0) + 1);
for (const [b, k] of viden) if (k > 1) problemi.push(`Broj ${b} nosi ${k} unosa — broj je adresa, ne oznaka.`);

// Preskaču se generisani i tuđi folderi; `.next` sadrži kopije naših komentara iz build-a.
const PRESKOCI = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', 'worktrees', 'qa-snimci']);
const NASTAVCI = ['.md', '.ts', '.tsx', '.mjs', '.js', '.yml'];

function* fajlovi(dir) {
  for (const ime of readdirSync(dir)) {
    if (PRESKOCI.has(ime)) continue;
    const put = join(dir, ime);
    if (statSync(put).isDirectory()) yield* fajlovi(put);
    else if (NASTAVCI.some((n) => ime.endsWith(n))) yield put;
  }
}

const postoji = new Set(brojevi);
for (const put of fajlovi('.')) {
  const sadrzaj = readFileSync(put, 'utf8');
  for (const m of sadrzaj.matchAll(/zamk[a-zšć]*\s+(\d+\.\d+[a-z]?)/gi)) {
    if (!postoji.has(m[1])) {
      problemi.push(`${put.split(sep).join('/')}: pokazuje na zamku ${m[1]}, koja ne postoji.`);
    }
  }
}

if (problemi.length > 0) {
  console.error(`Numeracija zamki — ${problemi.length} problem(a):`);
  for (const p of problemi) console.error('  ' + p);
  process.exit(1);
}
console.log(`Numeracija zamki u redu: ${brojevi.length} unosa, nijedan duplikat, svi pokazivači vode negde.`);
