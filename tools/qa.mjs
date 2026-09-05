// `npm run qa` — otvara ključne ekrane panela u pravom (headless) browseru, jednom komandom.
//
// ZAŠTO POSTOJI (odobrio vlasnik 5.9.2026, dok. 39 nalaz 2.4): `tools/qa-screenshot.mjs` već
// ume da proveri JEDAN ekran, ali se poziva ručno, pa se u praksi pokreće tek kad se greška
// već prijavi. Tri kvara u jednom danu (izvoz koji nije funkcija u `use server` fajlu i koji je
// oborio Najave, prazan odgovor koji je izgledao kao pokvarena granica greške, i ranije
// `ReferenceError` u sortiranju) žive ISKLJUČIVO u browseru — ne vidi ih ni `tsc`, ni `build`,
// ni testovi, ni `curl`. Ovo je najjeftinija provera koja tu klasu uopšte može da uhvati
// (zamka 7.1 u `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`).
//
// ŠTA OVO NIJE: nije zamena za testove i ne tvrdi da je ekran ISPRAVAN — tvrdi samo da se
// otvorio i da browser nije prijavio grešku. Pogrešan broj u tabeli ovo neće videti.
//
// Pokretanje (panel mora da radi na :3100):
//   npm run qa                      — svi ekrani
//   npm run qa -- katalog e-posta   — samo ekrani čiji ključ počinje tako
//
// Nalog i adresa se čitaju iz okruženja, isto kao u `qa-screenshot.mjs`:
//   QA_EMAIL, QA_PASSWORD, QA_TOTP_SECRET, PANEL_URL, QA_SETTLE_MS
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { authenticator } from 'otplib';

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const PANEL = process.env.PANEL_URL ?? 'http://localhost:3100';
const EMAIL = process.env.QA_EMAIL ?? 'qa.pretraga@tt-test.local';
const PASSWORD = process.env.QA_PASSWORD ?? 'QaPretraga123!';
const SECRET = process.env.QA_TOTP_SECRET ?? 'GVOWG4JTJNSVGYYB';
const SETTLE_MS = Number(process.env.QA_SETTLE_MS ?? 4000);
const IZLAZ = 'qa-snimci';

// Ekrani se biraju po tome gde greška najviše boli, ne po broju: ulaz u aplikaciju, radne
// liste koje agent drži otvorene ceo dan, i ekrani koji su nas već ujeli.
// `nadji` postoji za ekrane sa promenljivom adresom (dosije jedne rezervacije) — adresa se
// otkriva iz prethodnog ekrana, jer upisan ID postane netačan čim se baza ponovo napuni.
const EKRANI = [
  { kljuc: 'pocetna', naziv: 'Početna', putanja: '/' },
  { kljuc: 'lista', naziv: 'Lista rezervacija', putanja: '/rezervacije/lista' },
  {
    kljuc: 'dosije',
    naziv: 'Dosije rezervacije',
    nadji: async (page) => {
      await page.goto(`${PANEL}/rezervacije/lista`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(5000);
      // Red u listi NIJE `<a>` — dosije se otvara kao tab preko `openTab()` (BookingsTable.tsx),
      // pa se adresa ne može pročitati iz `href`. Broj rezervacije se čita iz prve ćelije i od
      // njega se sklapa adresa — isto što bi uradio i klik.
      // Prva ćelija je kvadratić za izbor reda, pa se broj traži kroz prvih nekoliko ćelija
      // umesto da se pozicija fiksira — kolona sme da se pomeri a da provera ne pukne.
      const broj = await page.evaluate(() => {
        const red = document.querySelector('tbody tr');
        if (!red) return null;
        for (const celija of [...red.children].slice(0, 4)) {
          const tekst = celija.textContent?.trim() ?? '';
          if (/^[A-Z][A-Za-z0-9-]{5,}$/.test(tekst)) return tekst;
        }
        return null;
      });
      return broj ? `/rezervacije/lista/${broj}` : null;
    },
  },
  { kljuc: 'pretraga', naziv: 'Pretraga ponude', putanja: '/rezervacije/pretraga?type=ACCOMMODATION' },
  { kljuc: 'najave', naziv: 'Najave dobavljačima', putanja: '/rezervacije/najave' },
  { kljuc: 'katalog', naziv: 'Katalog proizvoda', putanja: '/katalog' },
  { kljuc: 'e-posta', naziv: 'E-pošta', putanja: '/email' },
  { kljuc: 'izvestaji', naziv: 'Izveštaji', putanja: '/izvestaji' },
];

// Upozorenja koja dolaze iz alata, a ne iz našeg koda — prijavljuju se odvojeno od grešaka da
// pravi kvar ne bi utonuo u šum. Lista se drži KRATKOM namerno: svaki novi red ovde smanjuje
// ono što provera uopšte može da vidi, pa ide samo uz obrazloženje.
const SUM = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  // Browser uz svaki pao zahtev ispiše i ovu poruku BEZ adrese; adresa se hvata preko
  // `response` događaja ispod, pa bi ovaj red bio samo duplikat bez ijednog novog podatka.
  /Failed to load resource/i,
];

// Zahtevi kojima je status 4xx OČEKIVAN, sa razlogom — provera bez ovoga prijavljuje kvar
// tamo gde ga nema, a takva provera se posle par prolaza prestane čitati. Lista je uska
// namerno: pravilo je jedna adresa i jedan razlog, nikad „ignoriši sve 404".
const OCEKIVANI_NEUSPESI = [
  {
    // Gornja traka pita za AI aktivaciju modula na kom se korisnik nalazi. Aktivacija postoji
    // samo za M15_* (`module_agent_activations`), pa za M2/M5/... nema reda i API vraća 404.
    // `StatusBar.tsx` to hvata i sekciju jednostavno ne prikaže — dogovoreno ponašanje, ne kvar.
    uzorak: /\/api\/module-activation\//,
    status: 404,
    razlog: 'modul nema AI aktivaciju — StatusBar tada sakriva sekciju',
  },
];

const trazeni = process.argv.slice(2);
const izabrani = trazeni.length > 0
  ? EKRANI.filter((e) => trazeni.some((t) => e.kljuc.startsWith(t)))
  : EKRANI;

if (izabrani.length === 0) {
  console.error(`Nijedan ekran ne odgovara: ${trazeni.join(', ')}`);
  console.error(`Postojeći ključevi: ${EKRANI.map((e) => e.kljuc).join(', ')}`);
  process.exit(2);
}

rmSync(IZLAZ, { recursive: true, force: true });
mkdirSync(IZLAZ, { recursive: true });

const browser = await chromium.launch(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

// Prijava ide preko istog BFF puta kao iz browsera, pa kolačić sesije završi u kontekstu koji
// potom otvara sve ekrane — jedna prijava za ceo prolaz.
const login = await context.request.post(`${PANEL}/api/session/login`, { data: { email: EMAIL, password: PASSWORD } });
const loginBody = await login.json().catch(() => ({}));
if (loginBody.requiresMfa) {
  const mfa = await context.request.post(`${PANEL}/api/session/mfa`, {
    data: { mfaToken: loginBody.mfaToken, code: authenticator.generate(SECRET) },
  });
  if (!mfa.ok()) {
    console.error(`Prijava (MFA) nije prošla: ${mfa.status()} ${await mfa.text()}`);
    await browser.close();
    process.exit(2);
  }
} else if (!login.ok()) {
  console.error(`Prijava nije prošla: ${login.status()} ${JSON.stringify(loginBody)}`);
  console.error(`Da li panel radi na ${PANEL} i da li QA nalog postoji u bazi?`);
  await browser.close();
  process.exit(2);
}

const nalazi = [];

for (const ekran of izabrani) {
  const page = await context.newPage();
  const greske = [];
  const upozorenja = [];

  page.on('console', (msg) => {
    const tekst = msg.text();
    if (SUM.some((r) => r.test(tekst))) return;
    if (msg.type() === 'error') greske.push(`[console] ${tekst}`);
    else if (msg.type() === 'warning') upozorenja.push(`[warning] ${tekst}`);
  });
  // `pageerror` je neuhvaćen izuzetak — to je tačno ono što ekran obori, pa uvek ide u greške.
  page.on('pageerror', (err) => greske.push(`[pageerror] ${err.message}`));
  // Browser u konzoli piše samo „Failed to load resource: 404" BEZ adrese, pa se adresa mora
  // uhvatiti ovde — bez nje se ne zna ni koji je zahtev pao, ni da li je uopšte važan.
  page.on('response', (res) => {
    if (res.status() < 400) return;
    const ocekivan = OCEKIVANI_NEUSPESI.find((o) => o.status === res.status() && o.uzorak.test(res.url()));
    if (ocekivan) return;
    greske.push(`[HTTP ${res.status()}] ${res.url()}`);
  });
  page.on('requestfailed', (req) => greske.push(`[requestfailed] ${req.url()} — ${req.failure()?.errorText ?? ''}`));

  let putanja = ekran.putanja;
  let status = null;
  try {
    if (ekran.nadji) {
      putanja = await ekran.nadji(page);
      if (!putanja) {
        nalazi.push({
          ekran,
          status: null,
          greske: ['Adresa nije pronađena na prethodnom ekranu (prazna lista?)'],
          upozorenja,
        });
        await page.close();
        continue;
      }
    }
    const odgovor = await page.goto(`${PANEL}${putanja}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    status = odgovor?.status() ?? null;
    await page.waitForTimeout(SETTLE_MS);

    // Granica greške (`error.tsx`) prikaže našu poruku, a HTTP status ostane 200 — bez ove
    // provere bi pukao ekran prošao kao ispravan (zamka 7.1b).
    const palo = await page.evaluate(() =>
      document.body.innerText.includes('Ovaj ekran nije uspeo da se prikaže')
      || document.body.innerText.includes('Panel se nije učitao'));
    if (palo) greske.push('Prikazana je stranica greške umesto sadržaja ekrana');

    await page.screenshot({ path: `${IZLAZ}/${ekran.kljuc}.png`, fullPage: false });
  } catch (err) {
    greske.push(`[pad] ${err.message}`);
  }

  if (status !== null && status >= 400) greske.push(`HTTP ${status}`);
  nalazi.push({ ekran, putanja, status, greske, upozorenja });
  await page.close();
}

await browser.close();

console.log('');
for (const n of nalazi) {
  const oznaka = n.greske.length > 0 ? 'GREŠKA' : n.upozorenja.length > 0 ? 'upoz.' : 'u redu';
  console.log(`${oznaka.padEnd(7)} ${n.ekran.naziv.padEnd(24)} ${n.status ?? ''} ${n.putanja ?? ''}`);
  for (const g of [...new Set(n.greske)].slice(0, 8)) console.log(`        ${g}`);
  for (const u of [...new Set(n.upozorenja)].slice(0, 5)) console.log(`        ${u}`);
}

const paliEkrani = nalazi.filter((n) => n.greske.length > 0);
console.log(`\nSnimci: ${IZLAZ}/`);
console.log(paliEkrani.length === 0
  ? `Svih ${nalazi.length} ekrana se otvorilo bez greške iz browsera.`
  : `Ekrana sa greškom: ${paliEkrani.length} od ${nalazi.length}.`);

process.exit(paliEkrani.length > 0 ? 1 : 0);
