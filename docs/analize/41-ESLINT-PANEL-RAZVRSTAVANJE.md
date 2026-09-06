# ESLint nalazi u panelu — razvrstavanje pre ispravki

**Nastalo:** 6.9.2026, pošto je lint u `apps/panel` i `apps/web` prvi put uopšte proradio (commit `fbc4608` — do tada je pucao pre nego što pogleda ijedan fajl, vidi zamku 5.23).
**Svrha:** podeliti 101 grešku u panelu na tri gomile i za svaku dati preporuku, da vlasnik odluči šta se radi — umesto da se sve „popravlja" jer alat tako kaže.
**Klase dokaza** (po `40-PRAVILA-REVIZIJE-KODA.md`): svaki nalaz ispod nosi oznaku — **[izmereno]** izlaz alata, **[u kodu]** pročitan izvorni kod, **[procena]** moj sud o posledici.

Stanje pri pisanju **[izmereno]**: `apps/panel` 190 prijava (101 greška, 89 upozorenja), `apps/web` 9 prijava (7 grešaka, 2 upozorenja). Ovaj dokument pokriva 101 grešku u panelu.

---

## Sažetak

| Gomila | Prijava | Šta je to |
|---|---|---|
| **A — mehaničko** | 54 | Ispravke koje ne menjaju ponašanje ekrana. Bezbedno. |
| **B — stvaran rizik** | 11 | Kod koji može da se pokvari ili već tiho radi pogrešno. |
| **C — pravilo ne odgovara našoj arhitekturi** | 36 | Alat prijavljuje obrazac koji je kod nas namerno i ispravan. |

54 + 11 + 36 = 101. Najvažniji red je **B**, i u njemu tri nalaza iste klase kao zamka 7.3 — greška koja je vlasniku uživo oborila ekran.

---

## Gomila A — mehaničke ispravke (54)

Ne menjaju ponašanje. Preporuka: **uraditi sve**, u jednom prolazu.

### A1. `react/no-unescaped-entities` — 29
**[izmereno]** Svih 29 je isti znak: prav navodnik `"` unutar srpskog teksta u JSX-u. Primer, `TerminalPanel.tsx:129`:

```tsx
<Icon name="check" /> Poslato u "{sentTo}"
```

**[procena]** Sam po sebi ne kvari ništa — tekst se ispisuje ispravno. Ali prav navodnik je i **tipografski pogrešan za srpski**: treba „…". Ispravka time rešava dve stvari odjednom, pa je vredi uraditi umesto gasiti pravilo. Zamena sa `&quot;` se **ne** preporučuje — čini srpski tekst u kodu nečitljivim.

### A2. `react-hooks/static-components` — 18
**[u kodu]** `SortLabel` je definisan **unutar** komponente tabele (`RealBookingsTable.tsx:204`, `BookingsTable.tsx:222`), pa se pri svakom renderu pravi kao nova komponenta.

**[procena]** Posledica je ograničena (`SortLabel` nema sopstveno stanje), ali React je pri svakom renderu demontira i montira ispočetka — nepotreban posao na tabeli koja se osvežava filterima. Ispravka: izdvojiti funkciju izvan komponente i proslediti joj što joj treba kao propove.

**Napomena [u kodu]:** 9 od tih 18 je u `BookingsTable.tsx`, fajlu koji se **ne renderuje nigde** — živa tabela je `RealBookingsTable.tsx` (utvrđeno 5.9.2026, zamka 8.4). Ako se taj fajl obriše, devet nalaza nestaje bez ijedne izmene koda koji radi. Brisanje je zasebna odluka, ne deo ovog prolaza.

### A3. `@typescript-eslint/no-explicit-any` — 4
**[izmereno]** Sva četiri u `AiChatBox.tsx` (linije 77, 78, 271, 410). Ispravka: pravi tipovi umesto `any`.

### A4. `react/no-children-prop` — 2
**[u kodu]** `RealResults.tsx:203` i `:253` prosleđuju `children={quoteDefaults.children}` — gde `children` znači **broj dece na putovanju**, ne React sadržaj. Alat to ne može da zna.

**[procena]** Nije kvar, ali jeste zamka za čitaoca: `children` je rezervisano ime u React-u i svako ko naiđe pretpostavi da je reč o ugnježdenom sadržaju. Preporuka: preimenovati prop u `childrenCount` (ili `brojDece`) svuda gde nosi to značenje.

### A5. `react-hooks/preserve-manual-memoization` — 1
**[izmereno]** `KatalogSidebarPanel.tsx:148`. React Compiler je odustao od optimizacije te komponente jer ručno pisan `useMemo` ne može da se sačuva. **[procena]** Nije kvar; gubi se optimizacija. Traži pojedinačan pogled, nije mehaničko u strogom smislu — ali je jedan slučaj.

---

## Gomila B — stvaran rizik (11)

Preporuka: **pregledati jedan po jedan**, ovo je jedini deo gde lint plaća sam sebe.

### B1. `react-hooks/immutability` — 5 (od toga 3 stvarna) — *ista klasa kao zamka 7.3*
**[izmereno]** Svih pet nosi istu poruku: „Cannot access variable before it is declared". Ali nisu isti slučaj:

- **Tri stvarna** — `AiDockBottom.tsx:54`, `ResizablePane.tsx:74`, `TerminalPanel.tsx:578`: funkcija `onPointerUp` u svom telu pokazuje na samu sebe.
- **Dva bezopasna** — `Shell.tsx:268` i `:270`: pre deklaracije se koriste `setMainWidth` i `setAiDock`, a to su `useState` setteri, kojima React garantuje stabilan identitet. Nalaz je formalno tačan, posledice nema. Preporuka je da se svejedno presloži redosled — ne zbog kvara, nego da bi preostala tri ostala vidljiva.

**[u kodu]** Primer, `AiDockBottom.tsx`:

```tsx
const onPointerUp = useCallback(() => {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);   // ← pokazuje na samu sebe
}, [onPointerMove]);
```

**[procena]** Danas radi, jer je `onPointerMove` stabilan (`[]`), pa je i `onPointerUp` stabilan. Ali obrazac je taj da funkcija drži **staru verziju sebe**: čim se zavisnost promeni, `removeEventListener` uklanja pogrešnu referencu i osluškivač ostaje zakačen za `window`. To je tiho curenje, ne pad — ne vidi se dok se panel ne počne otvarati i zatvarati često.

Ovo je **ista klasa** kao `ReferenceError: Cannot access 'sort' before initialization` (zamka 7.3), koja je vlasniku uživo oborila ekran pretrage. Tada je nije uhvatio nijedan test, jer se okidala tek na više od jednog rezultata. Lint je vidi bez pokretanja.

### B2. `react-hooks/refs` — 6
**[izmereno]** `ProcessMapView.tsx:50`, `ProductPreviewCard.tsx:59` (×2), `SearchResultsMap.tsx:247`, `:254`, `:257`.

**[u kodu]** Primer, `ProductPreviewCard.tsx:59`: `const detail = cacheRef.current.get(activeId);` — vrednost iz `ref`-a se čita **tokom rendera** i od nje zavisi šta se iscrta.

**[procena]** `ref` se menja bez ponovnog rendera, pa ekran može da prikaže staru vrednost dok ga nešto drugo ne osveži — kvar oblika „podatak je stigao, ali se ne vidi". Da li se to stvarno dešava, mora se proveriti na ekranu; sam nalaz ne dokazuje da se dešava.

---

## Gomila C — pravilo ne odgovara našoj arhitekturi (36)

Preporuka: **ne ispravljati kod**, nego podesiti pravilo — uz obrazloženje upisano u konfiguraciju.

### C1. `react-hooks/set-state-in-effect` — 32 (od toga 19 legitimnih)
**[u kodu]** Prošao sam kroz sve 32 i razvrstao ih:

| Obrazac | Broj | Ocena |
|---|---|---|
| Čitanje stanja iz browsera posle montiranja (`localStorage`, `matchMedia`, `document`, `new Date()`) | 11 | **Ispravno i obavezno.** Ovo je jedini bezbedan način u SSR-u: server i prvi klijentski render moraju biti identični, pa se vrednost sme pročitati tek posle hidratacije. Ranija verzija koja je čitala `localStorage` direktno u `useState` inicijalizatoru je **napravila prijavljenu „Hydration failed" grešku** (21.8.2026) — današnji oblik je ispravka te greške. |
| Brisanje starog podatka pre novog dohvatanja (`setX(null)` pa `fetch`) | 8 | **Ispravno.** Bez toga ekran drži tuđ podatak dok novi ne stigne. |
| Izvedeno stanje iz propova (`useEffect(() => setX(f(prop)), [prop])`) | 7 | **Nalaz je opravdan.** Ovo React dokumentacija izričito ne preporučuje — vrednost treba računati u renderu ili menjati `key`. Mesta: `AuditLogSearchForm.tsx:47`, `DateField.tsx:80`, `DateRangeField.tsx:205–207`, `AiChatBox.tsx:303`, `Sidebar.tsx:36`. |
| Ostalo (animacija kucanja, sinhronizacija sa putanjom, zatvaranje forme posle uspeha) | 6 | Traži pojedinačan pogled. |

**Preporuka:** pravilo spustiti sa **greške na upozorenje**, uz komentar u `eslint.config.mjs` koji kaže zašto (19 od 32 su namerni SSR obrasci, alat ih ne razlikuje). Sedam slučajeva izvedenog stanja ispraviti zasebno — to je stvaran, mada blag, nalaz. **Ne** stavljati 19 `eslint-disable` komentara: toliko izuzetaka čini pravilo nečitljivim.

### C2. `react-hooks/purity` — 3
**[izmereno]** `znanje/page.tsx:158`, `znanje/[id]/page.tsx:93`, `RightPanel.tsx:548` — `Date.now()` pozvan tokom rendera.

**[u kodu]** Reč je o oznakama tipa „osvežavanje dospelo" koje porede rok sa trenutnim vremenom. **[procena]** Formalno render nije čist; praktično se oznaka može zateći nesveža dok se ekran ne osveži iz drugog razloga. Za podsetnik koji ionako gleda dnevni rok — bez posledice. Preporuka: ostaviti, uz komentar; ako se pravilo održi kao greška, utišati tačkasto na ta tri mesta.

### C3. `@next/next/no-html-link-for-pages` — 1
**[u kodu]** `global-error.tsx:33` koristi običan `<a href="/">` umesto `<Link>`. To je **namerno i već objašnjeno u komentaru na tom mestu**: taj fajl se prikazuje kad padne i sam korenski raspored, gde se na router ne sme računati. Preporuka: `eslint-disable-next-line` sa tim obrazloženjem.

### C4. Upozorenja (89, van 101 greške)
**[izmereno]** 87 od 89 je `@typescript-eslint/no-unused-vars` i `no-unused-expressions`; preostala 2 su suvišni `eslint-disable` komentari u `ChatPanel.tsx` (pravilo koje gase više ne prijavljuje ništa). Nisu deo ovog razvrstavanja, ali `no-unused-vars` je jeftino pročistiti i vredi ga uraditi uz gomilu A.

---

## Šta preporučujem, redom

1. **Gomila B (11)** — prvo, jer je jedina koja može da napravi kvar kod korisnika. Pet nalaza je klase koja nas je već koštala oborenog ekrana.
2. **C1 sedam slučajeva izvedenog stanja** — stvaran nalaz unutar gomile koja se inače utišava.
3. **Gomila A (34)** — mehaničko, bezbedno, i usput ispravlja srpsku tipografiju.
4. **Podešavanje pravila (C1, C2, C3)** — tek na kraju, kad se zna šta ostaje.
5. **Lint u CI** — tek kad panel bude čist. Crven CI koji se ignoriše gori je nego da ga nema (zamka 11.3).

**Van ovog prolaza, kao zasebna odluka vlasnika:** brisanje `BookingsTable.tsx` (ne renderuje se nigde — zamka 8.4), čime devet nalaza iz A2 nestaje samo od sebe.
