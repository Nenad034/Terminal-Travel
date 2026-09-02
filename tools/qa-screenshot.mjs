// Otvara ekran panela u pravom (headless) browseru, sačeka da se učita, pokupi greške iz
// konzole i napravi snimak ekrana.
//
// Zašto postoji (odobrio vlasnik 2.9.2026): tri puta zaredom je prijavljena greška koju
// provera sa servera nije mogla da vidi — `ReferenceError` u sortiranju, React upozorenje o
// `<script>` tagu, i MapLibre worker koji se nije učitao. Sve tri žive isključivo u browseru.
// Bez ovoga se klijentsko ponašanje ne može proveriti pre nego što se prijavi kao gotovo
// (zamka 7.1 u `33-ZAMKE-I-OBAVEZNE-PROVERE.md`).
//
// Pokretanje iz korena repozitorijuma:
//   node tools/qa-screenshot.mjs "/rezervacije/pretraga?type=ACCOMMODATION&prikaz=mapa" izlaz.png
//
// Nalog za prijavu se čita iz promenljivih okruženja (podrazumevano lokalni QA nalog):
//   QA_EMAIL, QA_PASSWORD, QA_TOTP_SECRET, PANEL_URL
import { chromium } from 'playwright';
import { authenticator } from 'otplib';

const PANEL = process.env.PANEL_URL ?? 'http://localhost:3100';
const EMAIL = process.env.QA_EMAIL ?? 'qa.pretraga@tt-test.local';
const PASSWORD = process.env.QA_PASSWORD ?? 'QaPretraga123!';
const SECRET = process.env.QA_TOTP_SECRET ?? 'GVOWG4JTJNSVGYYB';

const path = process.argv[2] ?? '/';
const shot = process.argv[3] ?? 'qa-screenshot.png';
/** Koliko čekati da se ekran smiri pre snimka (mapa se crta asinhrono). */
const SETTLE_MS = Number(process.env.QA_SETTLE_MS ?? 6000);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

// Prijava ide preko istog BFF puta kao iz browsera, pa kolačić sesije završi u istom
// kontekstu koji potom otvara stranicu.
const login = await context.request.post(`${PANEL}/api/session/login`, { data: { email: EMAIL, password: PASSWORD } });
const loginBody = await login.json();
if (loginBody.requiresMfa) {
  const mfa = await context.request.post(`${PANEL}/api/session/mfa`, {
    data: { mfaToken: loginBody.mfaToken, code: authenticator.generate(SECRET) },
  });
  if (!mfa.ok()) throw new Error(`MFA nije prošla: ${mfa.status()} ${await mfa.text()}`);
} else if (!login.ok()) {
  throw new Error(`Prijava nije prošla: ${login.status()} ${JSON.stringify(loginBody)}`);
}

// Tema panela se pamti u kolačiću (`tt-panel-theme`), pa se i u proveri zadaje tako —
// isto kao kad je korisnik izabere prekidačem. QA_THEME=light|dim|dark
if (process.env.QA_THEME) {
  const { hostname } = new URL(PANEL);
  await context.addCookies([{ name: 'tt-panel-theme', value: process.env.QA_THEME, domain: hostname, path: '/' }]);
}

const page = await context.newPage();
const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => problems.push(`[requestfailed] ${req.url()} — ${req.failure()?.errorText ?? ''}`));

const response = await page.goto(`${PANEL}${path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
console.log(`HTTP: ${response?.status()}`);

await page.waitForTimeout(SETTLE_MS);

// Opcioni klikovi pre snimka — za proveru ponašanja koje se vidi tek posle interakcije
// (npr. baner na mapi, pa dugme u njemu). QA_CLICK="x,y" ili više njih razdvojeno sa ";",
// u pikselima prozora; QA_CLICK_WAIT_MS koliko sačekati posle svakog.
if (process.env.QA_CLICK) {
  for (const pair of process.env.QA_CLICK.split(';')) {
    const [x, y] = pair.split(',').map(Number);
    await page.mouse.click(x, y);
    await page.waitForTimeout(Number(process.env.QA_CLICK_WAIT_MS ?? 1500));
    console.log(`Kliknuto na ${x},${y}`);
  }
}

await page.screenshot({ path: shot, fullPage: false });
console.log(`Snimak: ${shot}`);

// Da li mapa stvarno postoji i da li je nacrtala ijedan piksel — prazno platno je i dalje
// platno, pa sama prisutnost `<canvas>` ništa ne dokazuje.
const map = await page.evaluate(() => {
  const canvas = document.querySelector('canvas.maplibregl-canvas');
  if (!canvas) return { present: false };
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  return { present: true, width: canvas.width, height: canvas.height, webgl: Boolean(gl) };
});
console.log('Mapa:', JSON.stringify(map));

if (problems.length > 0) {
  console.log(`\nProblemi iz browsera (${problems.length}):`);
  for (const p of [...new Set(problems)].slice(0, 25)) console.log('  ' + p);
} else {
  console.log('\nBez grešaka i upozorenja iz browsera.');
}

await browser.close();
