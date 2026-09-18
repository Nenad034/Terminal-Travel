// Proverava da svaka REST ruta iz `apps/api/src/modules/**/*.controller.ts` ima pomen u
// `docs/api/M<broj>-*.md` (CLAUDE.md, "API dokumentacija": obavezna stavka izlaznog kriterijuma
// svakog modula sa API-jem).
//
// ZAŠTO POSTOJI (18.9.2026, dok. 50 nalaz 3.3): pravilo je postojalo od avgusta, a niko ga nije
// merio — 76 ruta (M24 ceo modul) nije imalo primer, i broj je rastao tiho. Isti obrazac kao
// `provera-indeksa.mjs`: pravilo koje CI ne meri nije pravilo.
//
// KAKO RADI: putanja rute (`@Controller` prefiks + `@Get/@Post/...` deo) se traži u dokumentu
// modula u tri oblika — sa prefiksom modula (`/contracting/contracts/:id`), bez njega
// (`/contracts/:id`, kako većina dokumenata piše), i sa `{id}` umesto `:id`.
//
// DUG KOJI JE ZATEČEN: `tools/api-dok-poznati-nedostaci.txt` nabraja rute koje su bile
// nedokumentovane kad je provera uvedena. Provera PADA za svaku novu nedokumentovanu rutu koja
// nije u toj listi, i UPOZORAVA (ne pada) za redove liste koji su u međuvremenu dokumentovani —
// te redove treba obrisati, da lista bude spisak duga, ne spisak izuzetaka. Dodavanje u listu je
// dozvoljeno samo uz commit koji objašnjava zašto ruta NE treba da bude dokumentovana.
//
// POKRETANJE: `node tools/provera-api-dok.mjs` iz korena repozitorijuma (CI ga pokreće).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = path.join(root, 'apps', 'api', 'src', 'modules');
const docsDir = path.join(root, 'docs', 'api');
const baselinePath = path.join(root, 'tools', 'api-dok-poznati-nedostaci.txt');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith('.controller.ts') ? [full] : [];
  });
}

const docs = fs
  .readdirSync(docsDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => [f, fs.readFileSync(path.join(docsDir, f), 'utf8')]);

const baseline = new Set(
  fs.existsSync(baselinePath)
    ? fs
        .readFileSync(baselinePath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [],
);

const missing = [];
const seen = new Set();
let total = 0;

for (const file of walk(modulesDir)) {
  const parts = file.split(/[\\/]/);
  const mod = parts[parts.indexOf('modules') + 1];
  const num = (mod.match(/^m(\d+)/) ?? [])[1];
  if (!num) continue;
  const src = fs.readFileSync(file, 'utf8');
  const base = (src.match(/@Controller\('([^']*)'\)/) ?? [])[1] ?? '';
  const doc = docs.find(([name]) => name.startsWith(`M${num}-`));
  for (const m of src.matchAll(/@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)/g)) {
    total += 1;
    const full = '/' + base + (m[2] ? '/' + m[2] : '');
    const short = full.replace(/^\/[^/]+/, '');
    const key = `${m[1].toUpperCase()} ${full}`;
    seen.add(key);
    const variants = [
      full,
      short,
      short.replace(/:(\w+)/g, '{$1}'),
      full.replace(/:(\w+)/g, '{$1}'),
    ];
    const ok = doc && variants.some((v) => doc[1].includes(v));
    if (!ok) missing.push({ key, doc: doc?.[0] ?? `(nema docs/api/M${num}-*.md)` });
  }
}

const novi = missing.filter((m) => !baseline.has(m.key));
const zastareli = [...baseline].filter((k) => !missing.some((m) => m.key === k));
const nepostojeci = [...baseline].filter((k) => !seen.has(k));

console.log(
  `API dokumentacija: ${total} ruta, ${missing.length} bez primera (${missing.length - novi.length} poznat dug u ${path.basename(baselinePath)}).`,
);

if (zastareli.length > 0) {
  console.log(
    `\nUPOZORENJE — ${zastareli.length} red(ova) liste duga je u međuvremenu dokumentovano ili obrisano; obrisati ih iz ${path.basename(baselinePath)}:`,
  );
  for (const k of zastareli)
    console.log(`  ${k}${nepostojeci.includes(k) ? '  (ruta više ne postoji)' : ''}`);
}

if (novi.length > 0) {
  console.error(
    `\nGREŠKA — ${novi.length} ruta bez primera u docs/api/, a nisu u listi poznatog duga:`,
  );
  for (const m of novi) console.error(`  ${m.key}  →  ${m.doc}`);
  console.error(
    '\nDodati primer zahteva/odgovora u odgovarajući docs/api/M<broj>-*.md (CLAUDE.md, "API dokumentacija").',
  );
  process.exit(1);
}

console.log('Nijedna nova nedokumentovana ruta.');
