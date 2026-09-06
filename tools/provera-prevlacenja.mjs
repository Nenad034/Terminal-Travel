// Provera prevlačenja leve trake panela — ponašanje koje `npm run qa` ne može da vidi, jer se
// ne dešava pri otvaranju ekrana nego pri interakciji.
//
// ZAŠTO POSTOJI (6.9.2026): ispravka jednog ESLint nalaza uvela je regresiju koju je vlasnik
// prijavio uživo — „nekontrolisano širenje i skupljanje levog panela" čim miš uđe u zonu
// panela, bez ijednog klika. Uzrok: `addEventListener` sa istom funkcijom drugi put je duplikat
// i po specifikaciji se ZANEMARUJE zajedno sa svojim `signal`-om, pa je osluškivač ostajao
// vezan za prvi `AbortController`; kad se taj izgubi, `abort()` ne skida ništa. Dovoljan je bio
// jedan dvoklik. Provera koja je tu izmenu propratila radila je JEDNO uredno prevlačenje i
// prošla — zato ovde stoje i neuredni slučajevi (zamka 7.1e).
//
// Pokretanje (panel mora da radi na :3100):
//   node tools/provera-prevlacenja.mjs
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { authenticator } from 'otplib';

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const PANEL = process.env.PANEL_URL ?? 'http://localhost:3100';
const EMAIL = process.env.QA_EMAIL ?? 'qa.pretraga@tt-test.local';
const PASSWORD = process.env.QA_PASSWORD ?? 'QaPretraga123!';
const SECRET = process.env.QA_TOTP_SECRET ?? 'GVOWG4JTJNSVGYYB';

const browser = await chromium.launch(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const login = await context.request.post(`${PANEL}/api/session/login`, { data: { email: EMAIL, password: PASSWORD } });
const loginBody = await login.json().catch(() => ({}));
if (loginBody.requiresMfa) {
  await context.request.post(`${PANEL}/api/session/mfa`, {
    data: { mfaToken: loginBody.mfaToken, code: authenticator.generate(SECRET) },
  });
} else if (!login.ok()) {
  console.error(`Prijava nije prošla: ${login.status()}. Vidi tools/qa-nalog.mjs.`);
  await browser.close();
  process.exit(2);
}

const page = await context.newPage();
await page.goto(`${PANEL}/rezervacije/lista`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.waitForTimeout(5000);

const sirina = () => page.evaluate(() => {
  const rucka = document.querySelector('[class*="cursor-col-resize"]');
  return rucka?.parentElement ? Math.round(rucka.parentElement.getBoundingClientRect().width) : null;
});
const rucka = async () => (await page.locator('[class*="cursor-col-resize"]').first().boundingBox());

/** Pomeri miš na nekoliko mesta BEZ pritiska i vrati true ako se širina promenila. */
async function menjaSeBezPritiska() {
  const pre = await sirina();
  for (const [x, y] of [[500, 300], [900, 600], [150, 400]]) {
    await page.mouse.move(x, y, { steps: 8 });
    await page.waitForTimeout(250);
    if ((await sirina()) !== pre) return true;
  }
  return false;
}

const nalazi = [];
const proveri = (naziv, uslov, detalj = '') => {
  nalazi.push({ naziv, ok: uslov, detalj });
  console.log(`${uslov ? 'u redu ' : 'GREŠKA '} ${naziv}${detalj ? '  — ' + detalj : ''}`);
};

// 1. Uredno prevlačenje MORA da menja širinu (inače provera ne dokazuje ništa).
{
  const k = await rucka();
  const pre = await sirina();
  await page.mouse.move(k.x + k.width / 2, k.y + 120);
  await page.mouse.down();
  await page.mouse.move(k.x + 70, k.y + 120, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const posle = await sirina();
  proveri('uredno prevlačenje menja širinu', posle !== pre, `${pre} → ${posle}`);
  proveri('posle otpuštanja miš više ne menja širinu', !(await menjaSeBezPritiska()));
}

// 2. Dva `pointerdown` bez `pointerup` između (dvoklik, drhtaj ruke) — tačan uzrok regresije.
{
  const k = await rucka();
  await page.mouse.move(k.x + k.width / 2, k.y + 120);
  await page.mouse.down();
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
  proveri('dvostruki pritisak ne ostavlja prevlačenje upaljeno', !(await menjaSeBezPritiska()));
}

// 3. Otpuštanje van prozora — `pointerup` stigne na koordinati izvan vidljive površine.
{
  const k = await rucka();
  await page.mouse.move(k.x + k.width / 2, k.y + 120);
  await page.mouse.down();
  await page.mouse.move(k.x + 40, k.y + 120, { steps: 5 });
  await page.mouse.move(1599, 999, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  proveri('otpuštanje na ivici prozora ne ostavlja prevlačenje upaljeno', !(await menjaSeBezPritiska()));
}

await browser.close();

const pali = nalazi.filter((n) => !n.ok);
console.log(pali.length === 0
  ? `\nSve ${nalazi.length} provere prevlačenja prolaze.`
  : `\nPalo provera: ${pali.length} od ${nalazi.length}.`);
process.exit(pali.length > 0 ? 1 : 0);
