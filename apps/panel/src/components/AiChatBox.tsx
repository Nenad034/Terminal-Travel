'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import Link from 'next/link';
import { useTabs } from './TabsContext';
import { NAV_ITEMS } from '@/lib/nav';
import CopyButton from './CopyButton';

// Ispisivanje reč-po-reč (na zahtev vlasnika, 19.8.2026 — "kao u AI pretrazi u Chrome ili u
// VS Code"). Odgovor i dalje stiže u JEDNOM odgovoru sa servera (M15 omnisearch nema pravi
// streaming, poglavlje 6c.3 ostaje van obima) — ovo je čisto vizuelna animacija otkrivanja
// već primljenog teksta, ne prava postepena generacija. Poštuje `prefers-reduced-motion`
// (dizajn dok. poglavlje 6 — animacija nikad ne sme biti jedini nosilac informacije).
function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      return;
    }
    const words = text.split(' ');
    let i = 0;
    setShown('');
    const t = setInterval(() => {
      i += 1;
      setShown(words.slice(0, i).join(' '));
      if (i >= words.length) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, [text]);
  return <p>{shown}</p>;
}

// M15 spec §6.6 (glasovni modalitet) — prvi kanal je M17/interni tim preko mikrofona, glasom se
// nikad ne izvršava radnja direktno (transkribovan tekst prolazi kroz IDENTIČAN `send()` tok kao
// kucanje, koji sam po sebi već nikad ne izvršava radnju — OmnisearchAgent samo analizira/
// predlaže), audio se ne čuva posle transkripcije. Implementirano preko ugrađenog browser Web
// Speech API-ja (22.8.2026, na zahtev vlasnika: "omogucite i razgovor sa ai agentom, dodajte
// ikonu mikrofona") — NAMERNO bez spoljnog STT provajdera/nove zavisnosti (M15 backlog je to
// ostavio otvoreno): audio se transkribuje LOKALNO u pregledaču i nikad ne napušta uređaj kao
// zvučni zapis, na server ide isključivo tekst, identično kao ručno kucanje. Podržano u Chrome/
// Edge (Chromium `webkitSpeechRecognition`); dugme se ne prikazuje uopšte u pregledačima bez
// podrške (Firefox/stariji Safari) — nema polovičnog/pokvarenog stanja.
declare global {
  interface Window {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  }
}

interface OmnisearchResponse {
  active: boolean;
  matchedRoutes: { label: string; href: string }[];
  entityResults: { type: string; id: string; label: string; href: string }[];
  aiAnswer?: string;
}

interface Turn {
  question: string;
  contextLabel?: string;
  answer?: string;
  links: { label: string; href: string }[];
  loading: boolean;
  inactive: boolean;
}

// Prečice ispod polja za unos (dizajn dok. §6c — "šta još"), na zahtev vlasnika 19.8.2026.
const QUICK_LINK_IDS = ['pretraga', 'crm', 'katalog', 'podrska'];

// Dizajn dok. §6c/§6c.1 — polje za AI razgovor fiksirano pri dnu centralnog panela, na SVAKOM
// ekranu bez obzira koji modul je aktivan (ispravka 19.8.2026, na zahtev vlasnika — prvi
// pokušaj ga je stavio u poseban desni panel, vlasnik je tražio centralni). `+` prilaže
// kontekst (trenutno otvoren zapis / rezultati trenutne pretrage) kao čip iznad polja —
// jedino dvoje od §6c.1 stvarno izvodljivo bez dodatnog backend rada (prilog fajla i
// pretraga interneta zahtevaju M15 alate koji još ne postoje za ovaj kanal, van obima).
// Svaki upit i dalje ide preko postojećeg POST /api/omnisearch (jednokratan poziv, M15 spec
// §9), bez memorije prethodnih poruka na serveru — istorija ispod je čisto prikazna.
// Slash komande, dugme "Zaustavi", istorija po zapisu, traka mode/dozvola (§6c.2), pravi
// streaming/izvori-kao-pilule-sa-tipom/predložena pitanja (§6c.3) ostaju van obima.
// `maximized` (25.8.2026, na zahtev vlasnika: "omogucite da se ai agent po zelji poveca visinu
// na visinu ekrana") — Shell.tsx daje plutajućem prozoru pravu (definisanu) visinu preko
// `top`+`bottom` fiksnog pozicioniranja SAMO kad je uvećan (podrazumevano je prozor auto-visine,
// ograničen `max-h-[70vh]`, koji NIJE "definisana" visina za CSS procentualno nasleđivanje).
// Zato `h-full`/`flex-1` ovde imaju efekat isključivo kad je `maximized=true` — u suprotnom
// (`maximized=false`/nedostaje) ponašanje ostaje IDENTIČNO ranijem (`max-h-64`), bez rizika da
// se pokvari podrazumevani mali prozor.
export default function AiChatBox({ maximized = false }: { maximized?: boolean }) {
  const { tabs, activePath, openTab } = useTabs();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<string | null>(null);
  // Naziv otvorenog taba se automatski prilaže kao kontekst na svaku poruku (22.8.2026, na
  // zahtev vlasnika, posle uživo zabune — AI je pitao "koji tab je otvoren" umesto da to zna).
  // Isti podatak koji je ranije zahtevao ručan klik na "+" (poglavlje 6c) — AI i dalje ne vidi
  // sadržaj ekrana, samo naziv zapisa, i sam ga pretražuje svojim alatima kad je relevantno.
  // `dismissedForPath` pamti da je korisnik svesno uklonio kontekst za TRENUTNI tab (X na čipu)
  // — ne vraća se dok se tab ne promeni, da uklanjanje stvarno nešto znači.
  const [dismissedForPath, setDismissedForPath] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);
  // Pozicija menija u pikselima, računa se pri OTVARANJU iz stvarnog položaja dugmeta na ekranu
  // (23.8.2026, na zahtev vlasnika, uz snimak ekrana — meni se i dalje sekao na donjoj ivici
  // plutajućeg prozora i posle v1.83 "otvara nadole" ispravke). Uzrok: `overflow-hidden` na
  // plutajućem prozoru (Shell.tsx) seče SVAKI apsolutno pozicioniran element koji izađe van
  // NJEGOVIH stvarnih (sadržajem određenih) granica — smer otvaranja menija (gore/dole) tu ništa
  // ne menja, jer panel nije fiksne visine, samo se uklapa oko sadržaja. Jedino pravo rešenje je
  // da meni izađe iz tog roditelja preko portala (ispod), umesto da bude njegovo dete.
  const [plusMenuPos, setPlusMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // BAG (23.8.2026, prijavio vlasnik uživo — "Hydration failed... Expected server HTML to
  // contain a matching <button>") — `typeof window !== 'undefined'` direktno u telu komponente
  // je na serveru uvek `false` (nema mikrofon dugmeta), ali na klijentu tokom SAME hidratacije
  // `window` već postoji, pa bi prvi klijentski render odmah ubacio dugme koje server nije poslao
  // — mimoilaženje se dešava PRE nego što React stigne da ih uskladi. Ispravljeno istim bezbednim
  // obrascem kao `Shell.tsx` `sidebarCollapsed` — počinje `false` na oba (server i prvi klijentski
  // render moraju biti identični), stvarna provera se radi tek u `useEffect` POSLE hidratacije.
  const [speechSupported, setSpeechSupported] = useState(false);
  useEffect(() => {
    setSpeechSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const activeTab = tabs.find((t) => t.path === activePath);
  const isSearchTab = activePath.startsWith('/rezervacije/pretraga') && activePath.includes('?');
  // Isključuje samo NEIZMENJENU podrazumevanu Početnu (prazna kontrolna tabla) — ne isključuje
  // po ruti '/' samog po sebi, jer Agent Inbox nema sopstvenu rutu i otvara se kao tab na '/' sa
  // drugačijim nazivom (M15 spec §6, "Agent Inbox nema sopstvenu rutu — otvara Početnu kao nov
  // tab"). Ispravka 22.8.2026, uživo nalaz — automatski kontekst je ćutke izostajao baš na tom
  // tabu jer je provera bila `activePath !== '/'`, ne naziv taba.
  const homeLabel = NAV_ITEMS.find((i) => i.id === 'pocetna')?.label;
  const isUnlabeledHome = !activeTab || activeTab.label === homeLabel;
  const autoContext = !isUnlabeledHome && dismissedForPath !== activePath ? activeTab!.label : null;
  const effectiveContext = context ?? autoContext;

  useEffect(() => {
    setContext(null);
    setDismissedForPath(null);
  }, [activePath]);

  // Vidljiv tekst trenutnog taba, automatski prilagan na svaku poruku (22.8.2026, na zahtev
  // vlasnika, posle uživo razjašnjenja — "AI treba da može da vidi sadržaj u centralnom panelu").
  // `#tt-main-content` (Shell.tsx) obuhvata samo sadržaj taba, NE i sam AiChatBox (odvojen
  // sibling element) — nema rizika da razgovor pročita sopstvenu istoriju. Isto pravilo
  // uklanjanja kao naziv taba: X na čipu (`dismissedForPath`) prekida i ovo za taj tab, ne samo
  // labelu. Klijentsko sečenje je pogodnost (manji payload) — server ionako ponovo seče
  // (`PAGE_CONTENT_MAX_CHARS`, omnisearch.service.ts), odbrana u dubinu.
  function readPageContent(): string | undefined {
    if (dismissedForPath === activePath) return undefined;
    const text = document.getElementById('tt-main-content')?.innerText?.trim();
    return text ? text.slice(0, 8000) : undefined;
  }

  async function send(overrideText?: string) {
    const question = (overrideText ?? input).trim();
    if (!question) return;
    const sentContext = effectiveContext ?? undefined;
    const pageContent = readPageContent();
    // Istorija (25.8.2026, uživo — vlasnik je primetio da "da" posle pitanja o konkretnoj
    // rezervaciji dobija potpuno nepovezan odgovor, jer je svaki poziv bio izolovan razgovor).
    // Isti obrazac kao TerminalPanel.tsx (BiTerminalAgent, 23.8.2026) — samo tura sa stvarnim
    // odgovorom (ne učitavanje/neaktivno) ima šta da doprinese, server ionako seče na poslednjih 6.
    const history = turns.filter((t) => t.answer && !t.loading).map((t) => ({ question: t.question, answer: t.answer! }));
    setInput('');
    setContext(null);
    setTurns((t) => [...t, { question, contextLabel: sentContext, links: [], loading: true, inactive: false }]);

    const query = sentContext ? `[Kontekst: ${sentContext}] ${question}` : question;
    try {
      const res = await fetch('/api/omnisearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, pageContent, history }),
      });
      const data: OmnisearchResponse & { message?: string } = await res.json();
      // BAG (23.8.2026, prijavio vlasnik uživo) — `res.status` se ranije uopšte nije proveravao,
      // pa je istekla sesija (401, posle popravke u api-client.ts sad redak slučaj — samo ako i
      // refresh token istekne posle 7 dana) davala IDENTIČNU poruku kao "AI još nije aktiviran"
      // (`!data.active`, oba slučaja `active` falsy) — dva različita uzroka, ista zbunjujuća
      // poruka. Razdvojeno ovde: 401 dobija sopstvenu, tačnu poruku.
      if (res.status === 401) {
        setTurns((t) => {
          const next = [...t];
          next[next.length - 1] = { ...next[next.length - 1], loading: false, answer: 'Sesija je istekla — osveži stranicu i prijavi se ponovo.' };
          return next;
        });
        return;
      }
      setTurns((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        if (!data.active) {
          next[next.length - 1] = { ...last, loading: false, inactive: true };
          return next;
        }
        next[next.length - 1] = { ...last, loading: false, answer: data.aiAnswer, links: [...data.matchedRoutes] };
        return next;
      });
    } catch {
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = { ...next[next.length - 1], loading: false, answer: 'Zahtev nije uspeo — pokušaj ponovo.' };
        return next;
      });
    }
  }

  // Auto-šalje čim prepoznavanje govora završi (vlasnikova odluka preko AskUserQuestion,
  // 22.8.2026 — "automatski se šalje čim prestanete da govorite", ne popuni pa čeka klik).
  function toggleListening() {
    if (!speechSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new Ctor();
    recognition.lang = 'sr-RS';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) send(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const quickLinks = QUICK_LINK_IDS.map((id) => NAV_ITEMS.find((i) => i.id === id)).filter((i): i is (typeof NAV_ITEMS)[number] => Boolean(i));

  return (
    <div className={`flex flex-col ${maximized ? 'h-full' : ''}`}>
      {turns.length > 0 && <div className={`flex flex-col gap-3 overflow-y-auto py-2 ${maximized ? 'flex-1 min-h-0' : 'max-h-64'}`}>
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              {t.contextLabel && <div className="self-end text-[10px] italic text-ink-faint">kontekst: {t.contextLabel}</div>}
              <div className="group flex items-center gap-1 self-end">
                <CopyButton text={t.question} />
                <div className="rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-ink">{t.question}</div>
              </div>
              {t.loading ? (
                <div className="flex items-center gap-2 text-xs text-ink-faint">
                  <Icon name="loading" className="animate-spin" /> razmišljam...
                </div>
              ) : t.inactive ? (
                <div className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-xs text-ink-faint">
                  AI pretraga još nije uključena za ovaj panel.
                </div>
              ) : (
                <div className="group relative rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs text-ink">
                  {t.answer && (
                    <>
                      <CopyButton text={t.answer} className="absolute right-1.5 top-1.5" />
                      <TypewriterText text={t.answer} />
                    </>
                  )}
                  {t.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          target="_blank"
                          className="rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] text-accent hover:border-accent"
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                  {!t.answer && t.links.length === 0 && <p className="text-ink-faint">Nema rezultata.</p>}
                </div>
              )}
            </div>
          ))}
        </div>}

      {effectiveContext && (
        <div className="mx-2 mt-2 flex items-center gap-1.5 self-start rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] text-ink">
          <Icon name="link" />
          {effectiveContext}
          <button
            onClick={() => {
              setContext(null);
              setDismissedForPath(activePath);
            }}
            title="Ukloni kontekst"
            className="ml-0.5 hover:text-danger"
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      {/* Linije chata pojačane (21.8.2026, na zahtev vlasnika: "pojacajte boji linija chata
          jedva se vide u light modu, u dark modu neka budu jos svetlije") — `border-border`
          (§komentar globals.css, misli se za blage unutrašnje razdelnike) je bio praktično
          nevidljiv na belu/skoro-belu pozadinu u svetlom modu. Zamenjeno postojećim
          `ink.faint` tokenom (već prolazi 4.5:1 tekst-kontrast, dakle daleko iznad 3:1 praga
          za granice — §2a) — u svetlom modu tamniji/vidljiviji, a u tamnom modu SVETLIJI od
          `--border` (isti smer koji je vlasnik tražio), bez novog CSS tokena.

          Okvir OKO ovog dela (21.8.2026, drugi zahtev istog dana, uz snimak ekrana: "ovako
          treba da bude oivicen chat... Linija ne treba da ide u unutrasnjost panela") — ranije
          probano na `Shell.tsx` omotaču (`border-x`) je razvlačilo liniju kroz CEO
          `AiChatBox`, uključujući istoriju razgovora iznad (unutrašnjost panela) — POVUČENO.

          TREĆI ZAHTEV (21.8.2026, isti dan): "Uklonite linije gornjeg dela chata ostaje
          uokviren samo donji deo" — zajednički okvir oko OBA reda (unos + prečice) je i dalje
          crtao liniju oko gornjeg (unos) reda, što nije bilo traženo. Red za unos sad je bez
          ikakvog okvira; pun okvir (`border border-ink-faint`) ostaje SAMO oko donjeg reda
          (brze prečice). */}
      <div className="flex flex-shrink-0 items-center gap-2 px-2 py-2">
        <div ref={plusRef} className="relative">
          <button
            onClick={() => {
              if (!plusOpen && plusRef.current) {
                const rect = plusRef.current.getBoundingClientRect();
                setPlusMenuPos({ top: rect.bottom + 4, left: rect.left });
              }
              setPlusOpen((v) => !v);
            }}
            title="Priloži kontekst"
            className={`flex h-[31px] w-[31px] items-center justify-center rounded ${plusOpen ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2 hover:text-ink'}`}
          >
            <Icon name="add" />
          </button>
          {/* Portal ka document.body (23.8.2026) — vidi komentar uz `plusMenuPos` iznad za razlog.
              Pozicioniran preko `position: fixed` + izračunatih piksela, ne preko Tailwind
              `absolute`/`top-full` klasa (te su relativne u odnosu na roditelja, tačno ono što
              je izlagalo meni sečenju). `z-50` ovde je odbrana u dubinu — portal na kraju
              `<body>` već prirodno crta iznad ostatka stranice bez toga. */}
          {plusOpen &&
            plusMenuPos &&
            createPortal(
              <div
                style={{ top: plusMenuPos.top, left: plusMenuPos.left }}
                className="fixed z-50 w-56 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg"
              >
                <button
                  disabled={isUnlabeledHome}
                  onClick={() => {
                    if (activeTab) setContext(activeTab.label);
                    setPlusOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Icon name="file" /> Trenutno otvoren zapis{!isUnlabeledHome ? ` — ${activeTab!.label}` : ''}
                </button>
                <button
                  disabled={!isSearchTab}
                  onClick={() => {
                    setContext('rezultati trenutne pretrage');
                    setPlusOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Icon name="search" /> Rezultati trenutne pretrage
                </button>
              </div>,
              document.body,
            )}
        </div>
        <Icon name="sparkle" className="text-accent" />
        {speechSupported && (
          <button
            onClick={toggleListening}
            title={listening ? 'Zaustavi snimanje' : 'Pitaj glasom'}
            className={`flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded ${
              listening ? 'animate-pulse bg-danger-bg text-danger' : 'hover:bg-panel-2 hover:text-ink'
            }`}
          >
            <Icon name="mic" />
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder={listening ? 'Slušam...' : 'Pitaj AI ili traži rezervaciju/proizvod...'}
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          onClick={() => send()}
          title="Pošalji"
          className="flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded hover:bg-panel-2 hover:text-accent"
        >
          <Icon name="send" />
        </button>
      </div>

      {/* Centrirano (21.8.2026, na zahtev vlasnika: "centrirajte tagove na sredinu donje
          polovine chata") — ranije levo poravnato (`flex flex-wrap`), sad `justify-center`.
          Srednja linija (border-t koji je razdvajao ovaj red od reda za unos iznad) UKLONJENA
          (21.8.2026, noviji zahtev: "uklonite srednju liniju chata") — poništava prethodni
          "ostavite samo gornju liniju" pokušaj; oba reda sad bez razdelne linije između sebe.
          ISKOŠENE IVICE — probano pa POVUČENO (22.8.2026, isti dan, "ne sviđa mi se, vratite
          kako je bilo") — nazad na običan pravougaon tag/pilula oblik, bez skewX transform-a. */}
      <div className="flex flex-wrap justify-center gap-1.5 px-2 py-1.5">
        {quickLinks.map((item) => (
          <button
            key={item.id}
            onClick={() => openTab(item.href, item.label)}
            title={item.label}
            className="flex h-[26px] w-[26px] items-center justify-center rounded border border-ink-faint text-ink-faint hover:border-accent hover:text-ink"
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
    </div>
  );
}
