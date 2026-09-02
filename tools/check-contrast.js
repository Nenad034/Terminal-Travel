#!/usr/bin/env node
/**
 * Provera kontrasta boja po WCAG 2.1 — `docs/analize/29-DIZAJN-SISTEM-UI.md` §2a.
 *
 * ZAŠTO POSTOJI: §2a je tvrd, merljiv zahtev ("ne prolazi dok se ne proveri, ne 'izgleda dobro
 * na oko'"), a dokument je od 17.8.2026. više puta pominjao "kontrast-skriptu" kojom su vrednosti
 * proveravane — ta skripta nikad nije bila upisana u repozitorijum, nego pisana iznova u svakoj
 * sesiji i bacana. Posledica: svaka naredna sesija je merila po sopstvenoj implementaciji, bez
 * načina da se rezultat ponovi ili ospori. Ovde je jednom, kao deo repozitorijuma (2.9.2026).
 *
 * ŠTA RADI: čita `apps/panel/src/app/globals.css`, izvlači SVE blokove tokena (svetli/tamni/dim,
 * i `prefers-color-scheme` i `data-theme` varijante), pa za svaki mod meri svaki tekstualni token
 * protiv SVAKE pozadine uz koju se stvarno pojavljuje — ne protiv jedne pretpostavljene "opšte"
 * pozadine aplikacije (zamka 1.2 u `33-ZAMKE-I-OBAVEZNE-PROVERE.md`).
 *
 * Poluprovidne vrednosti (`--accent-soft`, 8-cifreni HEX sa alfa kanalom) se pre merenja
 * kompozituju preko podloge na kojoj stoje — merenje protiv same alfa vrednosti daje besmislen
 * broj, a upravo je taj par (`accent` na `accent-soft`) bio stvaran WCAG propust 17.8.2026.
 *
 * POKRETANJE:  node tools/check-contrast.js            (sve, izlazi 1 ako nešto padne)
 *              node tools/check-contrast.js --mode light
 *              node tools/check-contrast.js --all      (ispisuje i parove koji prolaze)
 */

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, '..', 'apps', 'panel', 'src', 'app', 'globals.css');

/* --- WCAG 2.1 relativna luminansa i odnos kontrasta ------------------------------------- */

function parseHex(hex) {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (i) => parseInt(h.substr(i, 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

/** Poluprovidnu boju spusti na neprovidnu, preko stvarne podloge iza nje. */
function composite(fg, bg) {
  if (fg.a >= 1) return fg;
  return {
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fgHex, bgHex) {
  const bg = parseHex(bgHex);
  const fgRaw = parseHex(fgHex);
  if (!bg || !fgRaw) return null;
  const fg = composite(fgRaw, bg);
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/* --- čitanje tokena iz globals.css ------------------------------------------------------- */

/**
 * Vraća { imeModa: { token: hex } }. Svetli mod postoji u dva bloka (`:root` i
 * `:root[data-theme='light']`) koji MORAJU biti identični — zamka 1.7; oba se čitaju
 * odvojeno upravo da bi se razlika videla, ne stopila.
 */
function readTokenBlocks(css) {
  const blocks = {};
  // Svaki blok: selektor { ... }. Uzimamo samo one koji definišu --bg (blokovi palete).
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    const body = m[2];
    if (!/--bg\s*:/.test(body)) continue;

    const tokens = {};
    const tre = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let t;
    while ((t = tre.exec(body)) !== null) {
      const value = t[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (/^#[0-9a-f]{6,8}$/i.test(value)) tokens[t[1]] = value.toLowerCase();
      else tokens[t[1]] = value; // npr. currentColor — beleži se, ne meri
    }

    // Redosled provera je bitan: `:root:not([data-theme='light'])` (tamni mod po OS-u) SADRŽI
    // niz "data-theme='light'", pa mora biti prepoznat PRE proste provere na 'light' — inače se
    // tamni OS blok imenuje kao svetli i tiho pregazi stvarnim svetlim blokom, a nikad ne bude
    // izmeren. (Baš ta greška je bila u prvoj verziji ove skripte, uhvaćena 2.9.2026.)
    let name;
    if (/not\(\[data-theme='light'\]\)/.test(selector)) name = 'dark (OS)';
    else if (/data-theme='dark'/.test(selector)) name = 'dark (prekidač)';
    else if (/data-theme='dim'/.test(selector)) name = 'dim (prekidač)';
    else if (/data-theme='light'/.test(selector)) name = 'light (prekidač)';
    else if (/^:root$/.test(selector)) name = 'light (OS)';
    else name = selector;

    if (blocks[name]) {
      console.error(`Upozorenje: dva bloka su prepoznata kao "${name}" — selektor "${selector}" prepisuje raniji.`);
    }
    blocks[name] = tokens;
  }
  return blocks;
}

/* --- šta se meri protiv čega ------------------------------------------------------------- */

/** Pozadine uz koje se tekst stvarno pojavljuje u panelu. */
const SURFACES = ['--bg', '--panel', '--panel-2', '--bar'];

/**
 * Parovi tekst/pozadina koji nisu "svaki tekst na svakoj površini":
 * semantički tekst na sopstvenoj pill pozadini, i tekst na punom/mekom akcentu.
 * Prag 3:1 se koristi tamo gde je element krupan ili je granica/UI element (§2a).
 */
const SPECIAL_PAIRS = [
  { fg: '--ok', bg: '--ok-bg', min: 4.5, note: 'oznaka na svojoj pill pozadini' },
  { fg: '--warn', bg: '--warn-bg', min: 4.5, note: 'oznaka na svojoj pill pozadini' },
  { fg: '--danger', bg: '--danger-bg', min: 4.5, note: 'oznaka na svojoj pill pozadini' },
  { fg: '--accent-ink', bg: '--accent', min: 4.5, note: 'tekst na punom dugmetu' },
  // §2a tvrdo pravilo: na accent-soft ide accent-strong, NIKAD accent — oba se mere da se
  // vidi da pravilo i dalje ima razlog da postoji, ne samo da trenutna vrednost prolazi.
  { fg: '--accent-strong', bg: '--accent-soft', min: 4.5, over: '--panel', note: 'tekst na mekom akcentu (pravilo §2a)' },
  { fg: '--accent', bg: '--accent-soft', min: 4.5, over: '--panel', note: 'ZABRANJENO pravilom §2a — meri se da se pokaže zašto', expectFail: true },
  { fg: '--accent2', bg: '--accent2-soft', min: 4.5, over: '--panel', note: 'sekundarni akcent na svojoj mekoj pozadini' },
];

/** Granice i linije — prag 3:1, ne 4.5:1 (§2a). */
const BORDER_PAIRS = [
  { fg: '--border', bg: '--panel', min: 3, note: 'granica kartice/forme' },
  { fg: '--border', bg: '--bg', min: 3, note: 'granica na osnovnoj pozadini' },
];

const TEXT_TOKENS = ['--text', '--text-dim', '--text-faint', '--icon-line'];

/* --- pokretanje ---------------------------------------------------------------------------- */

function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const modeArg = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : null;

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const blocks = readTokenBlocks(css);
  const names = Object.keys(blocks).filter((n) => !modeArg || n.startsWith(modeArg));

  if (names.length === 0) {
    console.error(`Nijedan blok tokena nije pronađen u ${CSS_PATH}` + (modeArg ? ` za mod "${modeArg}"` : ''));
    process.exit(2);
  }

  let failures = 0;
  const fmt = (v) => v.toFixed(2).padStart(6);

  for (const name of names) {
    const t = blocks[name];
    console.log(`\n=== ${name} ===`);

    const rows = [];

    for (const fg of TEXT_TOKENS) {
      if (!t[fg] || !t[fg].startsWith('#')) continue; // npr. --icon-line: currentColor
      for (const bg of SURFACES) {
        if (!t[bg]) continue;
        const min = fg === '--icon-line' ? 3 : 4.5;
        rows.push({ fg, bg, min, ratio: contrast(t[fg], t[bg]), note: '' });
      }
    }

    for (const p of [...SPECIAL_PAIRS, ...BORDER_PAIRS]) {
      if (!t[p.fg] || !t[p.bg]) continue;
      // meka (alfa) pozadina se prvo spusti na površinu ispod nje
      let bgHex = t[p.bg];
      if (p.over && parseHex(bgHex) && parseHex(bgHex).a < 1) {
        const base = parseHex(t[p.over]);
        const c = composite(parseHex(bgHex), base);
        bgHex = `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      }
      rows.push({ fg: p.fg, bg: p.bg, min: p.min, ratio: contrast(t[p.fg], bgHex), note: p.note, expectFail: p.expectFail });
    }

    for (const r of rows) {
      if (r.ratio === null) continue;
      const pass = r.ratio >= r.min;
      const known = r.expectFail === true;
      if (!pass && !known) failures++;
      if (!pass || showAll) {
        const flag = pass ? 'OK  ' : known ? 'ZNAN' : 'PAD ';
        const label = `${r.fg} na ${r.bg}`.padEnd(34);
        console.log(`  ${flag} ${label} ${fmt(r.ratio)}:1  (prag ${r.min}:1)${r.note ? '  — ' + r.note : ''}`);
      }
    }

    if (!showAll && rows.every((r) => r.ratio === null || r.ratio >= r.min || r.expectFail)) {
      console.log('  sve prolazi (pokreni sa --all za pun ispis)');
    }
  }

  // Zamka 1.7: svetli mod je definisan u dva bloka koji moraju biti identični.
  const pairsToCompare = [
    ['light (OS)', 'light (prekidač)'],
    ['dark (OS)', 'dark (prekidač)'],
  ];
  for (const [a, b] of pairsToCompare) {
    if (!blocks[a] || !blocks[b]) continue;
    const keys = new Set([...Object.keys(blocks[a]), ...Object.keys(blocks[b])]);
    const diff = [...keys].filter((k) => blocks[a][k] !== blocks[b][k]);
    if (diff.length) {
      failures++;
      console.log(`\n!! ${a} i ${b} se RAZLIKUJU (zamka 1.7) — ${diff.join(', ')}`);
    }
  }

  console.log(failures === 0 ? '\nSve provere prolaze.' : `\n${failures} par(ova) pada prag.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
