'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import Link from 'next/link';
import { useTabs } from './TabsContext';
import { NAV_ITEMS, NAV_GROUPS, type NavItem } from '@/lib/nav';
import CopyButton from './CopyButton';
import { useAiContext, type AiContextItem } from './AiContextContext';

// Dizajn dok. §6c.0 — strelica "Pošalji" u bojama loga (25.8.2026, na zahtev vlasnika: "Samo
// strelica neka bude u boji Loga"). ISTA tri tona kao logo (TopBar.tsx, fiksno, ne prati temu
// panela — brend ostaje isti bez obzira na temu, isti princip kao logo). Codicon glifovi ne
// podržavaju pouzdano `background-clip: text` preko ::before pseudo-elementa (razlog zašto ovo
// NIJE Icon.tsx codicon), pa je isti pristup kao BrendIcon.tsx — inline SVG, `<linearGradient>`.
function SendArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tt-send-gradient" x1="0" y1="16" x2="16" y2="0">
          <stop offset="0%" stopColor="#e8a63c" />
          <stop offset="50%" stopColor="#e2685a" />
          <stop offset="100%" stopColor="#a99bd8" />
        </linearGradient>
      </defs>
      <path
        d="M14.5 1.5 1.5 7.1c-.6.26-.55 1.13.07 1.32l4.8 1.48 1.48 4.8c.19.62 1.06.67 1.32.07L14.5 1.5Z"
        fill="none"
        stroke="url(#tt-send-gradient)"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M6.5 9.5 14.5 1.5" stroke="url(#tt-send-gradient)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

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
// Web Speech API nije deo standardnih TypeScript DOM tipova (`webkitSpeechRecognition` je
// Chromium-ovo proširenje), pa se opisuje ovde — i to SAMO ono što se stvarno koristi
// (6.9.2026, ESLint `@typescript-eslint/no-explicit-any`, dok. 41 A3). Ranije je stajalo `any`,
// što je gasilo svaku proveru: pogrešno ime svojstva ili poziv nepostojećeg metoda prošli bi
// i kroz `tsc` i kroz build, a pukli tek u pregledaču — i to samo u Chrome/Edge, gde jedini
// i radi.
interface PrepoznavanjeGovoraDogadjaj {
  results: { [index: number]: { [index: number]: { transcript?: string } } };
}

interface PrepoznavanjeGovora {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: PrepoznavanjeGovoraDogadjaj) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => PrepoznavanjeGovora;
    webkitSpeechRecognition?: new () => PrepoznavanjeGovora;
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
  contextLabels?: string[];
  answer?: string;
  links: { label: string; href: string }[];
  loading: boolean;
  inactive: boolean;
}

// Čitljiv naziv čipa za jednu kontekstnu stavku (dizajn dok. §6c.1a) — RECORD prikazuje samo
// referencu, FILTERED_LIST dodaje broj rezultata radi transparentnosti ("šta je agent video") —
// kad broj nije poznat unapred (kontekst iz nav-stavke, ne iz stvarno prikazane liste — vidi
// `filterableViewForPath` ispod), izostavlja se umesto lažnog "(undefined)".
function itemLabel(item: AiContextItem): string {
  if (item.type === 'RECORD') return item.refLabel;
  if (item.type === 'FILE') return `Fajl: ${item.label}`;
  if (item.type === 'IMAGE') return `Slika: ${item.label}`;
  return item.resultCount !== undefined ? `Filtrirano: ${item.label} (${item.resultCount})` : `Filtrirano: ${item.label}`;
}

// M15 spec §6.5.4.3 dopuna v1.43 (25.8.2026, na zahtev vlasnika — "kada se klikne na +
// omogucite unos nekog fajla", zatim "slika takodje i kao fajl i copy-paste"). Dokument
// (tekst/pdf/word/excel/html) se šalje na server preko ekstenzija/`extract-file.service.ts` da
// bi se izvukao tekst — TRANZIENTNO, fajl se nikad ne piše na disk. Slika NIKAD ne ide na server
// kao poseban upload korak — pretvara se u base64 direktno u pregledaču (Claude Vision je
// prihvata kao deo tela `/omnisearch` zahteva, isti "gotovo za jedan poziv" princip kao pageContent).
const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_FILE_ACCEPT = '.txt,.md,.csv,.json,.html,.htm,.pdf,.docx,.xlsx,.doc,.xls';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Ispravka (25.8.2026, uživo nalaz uz snimak ekrana — pitanje "koliko rezervacija ima u listi
// rezervacija" uz priložen kontekst "Lista rezervacija" je dobilo "ne vidim sadržaj ekrana"
// umesto da agent sam pozove `filter_list`). Uzrok: običan RECORD kontekst nosi SAMO čitljivu
// referencu — agent nema signal da "Lista rezervacija" odgovara TAČNO M15 `filter_list` pogledu
// `bookings` (filterable-views.ts, backend). Za rute koje IMAJU pravi pogled u tom registru,
// kontekst (auto-kontekst taba ILI "#" na stavci menija) sad postaje FILTERED_LIST sa PRAZNIM
// filterima (= "ceo spisak") umesto običnog RECORD-a — isti deterministički mehanizam kao dugme
// "Dodaj u AI kontekst" na traci filtera (BookingsListClient.tsx), samo bez aktivnih filtera.
// `resultCount` namerno izostavljen — klijent ovde ne zna stvaran broj (nema zaseban poziv
// serveru samo da bi se izbrojalo), backend/model to i dalje moraju stvarno da provere pozivom
// alata, ne da pretpostave iz broja u čipu.
const PATH_TO_FILTERABLE_VIEW: Record<string, string> = {
  '/rezervacije/lista': 'bookings',
  '/crm': 'crm',
  '/marketing': 'marketing',
  '/nadzor': 'health_signals',
};
function filterableViewForPath(pathname: string): string | null {
  const match = Object.keys(PATH_TO_FILTERABLE_VIEW).find((p) => pathname === p || pathname.startsWith(`${p}?`));
  return match ? PATH_TO_FILTERABLE_VIEW[match] : null;
}

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
// Dizajn dok. §6c.0 (dopuna 25.8.2026, na zahtev vlasnika) — AI chat napušta plutajući prozor,
// postaje STALAN deo desnog panela (RightPanel.tsx), naslagan ispod postojećeg sadržaja. Ranije
// `maximized` (ručno uvećanje plutajućeg prozora preko `top`/`bottom` pozicioniranja) je UKINUTO
// — roditelj (RightPanel dokovan prikaz, ~40% visine panela, ILI `/ai-asistent` Fokus tab preko
// celog centralnog prostora) sad UVEK daje definisanu visinu, pa je `h-full flex-1` layout ovde
// bezuslovan (nema više "kompaktnog" `max-h-64` stanja). `fokus=true` (Fokus tab, novo) sakriva
// dugme "Otvori u punom tabu" (već SI u punom tabu) i isključuje auto-kontekst čitanje ekrana
// (nema odvojenog "drugog" ekrana dok je AI chat sam ceo ekran — isto ponašanje kao prazna
// Početna, M15 spec §6.5.1).
export default function AiChatBox({ fokus = false }: { fokus?: boolean }) {
  const { tabs, activePath, openTab } = useTabs();
  const { items: contextItems, addRecord, addFilteredList, addFile, addImage, removeItem: removeContextItem, clear: clearContextItems, atCapacity } = useAiContext();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  // Naziv otvorenog taba se automatski prilaže kao kontekst na svaku poruku (22.8.2026, na
  // zahtev vlasnika, posle uživo zabune — AI je pitao "koji tab je otvoren" umesto da to zna).
  // Isti podatak koji je ranije zahtevao ručan klik na "+" (poglavlje 6c) — AI i dalje ne vidi
  // sadržaj ekrana, samo naziv zapisa, i sam ga pretražuje svojim alatima kad je relevantno.
  // `dismissedForPath` pamti da je korisnik svesno uklonio kontekst za TRENUTNI tab (X na čipu)
  // — ne vraća se dok se tab ne promeni, da uklanjanje stvarno nešto znači.
  // Dopuna (25.8.2026, M15 spec §6.5.4.3, dizajn dok. §6c.1a) — ručno priloženi kontekst više
  // nije jedna vrednost koja se zamenjuje sledećom, nego DELJENA lista (`AiContextContext`,
  // Shell.tsx) koju pune i ikonice po redu bilo kog ekrana, i dugme "Dodaj filtrirani prikaz",
  // ne samo ovo `+` polje — omogućava poređenje više zapisa u istom pitanju.
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
  // `bottom` (ne `top`) — dopuna 25.8.2026, dizajn dok. §6c.0: red za unos je sad na DNU panela
  // (ranije je bio pri vrhu, meni se otvarao nadole u prazan prostor ispod). Meni sad raste
  // NAGORE od dugmeta (`bottom: window.innerHeight - rect.top`), isti portal-van-roditelja
  // razlog kao ranije (`overflow-hidden` seče apsolutno pozicioniran element).
  const [plusMenuPos, setPlusMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const moduleButtonRef = useRef<HTMLDivElement>(null);
  const [modulePickerPos, setModulePickerPos] = useState<{ bottom: number; left: number } | null>(null);
  // §6c.0a (dopuna 25.8.2026, na zahtev vlasnika: "oznaka za kontekst... otvore svi moduli u
  // popup meniju... odabrati jedan od modula") — ISTA, ulogom filtrirana lista koju već koriste
  // Sidebar/CommandPalette (`visibleNavItems`, server-side) — učitana preko `/api/nav-items` jer
  // AiChatBox u Fokus tabu (`/ai-asistent`) nema pristup Shell.tsx-ovim server-side `items`
  // props-ima (posebna ruta, van tog stabla). Učitano jednom, ne po otvaranju menija.
  const [moduleItems, setModuleItems] = useState<NavItem[]>([]);
  useEffect(() => {
    fetch('/api/nav-items', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setModuleItems(Array.isArray(data) ? data.filter((i: NavItem) => i.implemented) : []))
      .catch(() => setModuleItems([]));
  }, []);
  // Prilog fajla/slike preko "+" (v1.43) — jedan skriven <input type=file>, grananje po MIME
  // tipu posle izbora (slika ide client-side u base64, dokument ide na server po tekst).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  async function addImageFile(file: File) {
    if (!IMAGE_MEDIA_TYPES.has(file.type)) {
      setFileUploadError(`Tip slike "${file.type || 'nepoznat'}" nije podržan (jpg/png/gif/webp).`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFileUploadError(`Slika je prevelika (max 5MB): ${file.name}`);
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    addImage({ label: file.name || 'slika', imageData: base64, imageMediaType: file.type });
  }

  async function addDocumentFile(file: File) {
    const formData = new FormData();
    formData.set('file', file);
    try {
      const res = await fetch('/api/ai-context/extract-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setFileUploadError(data?.message ?? `Fajl "${file.name}" nije mogao da se pročita.`);
        return;
      }
      addFile({ label: data.label ?? file.name, content: data.content ?? '' });
    } catch {
      setFileUploadError(`Fajl "${file.name}" nije mogao da se pošalje.`);
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setFileUploadError(null);
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) await addImageFile(file);
      else await addDocumentFile(file);
    }
  }

  // Lepljenje slike (Ctrl+V) direktno u polje za chat (v1.43, na zahtev vlasnika: "copy-paste")
  // — isti IMAGE mehanizam kao dugme za prilog, samo drugi okidač, bez servera.
  function handlePasteImage(e: React.ClipboardEvent<HTMLInputElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    setFileUploadError(null);
    addImageFile(file);
  }

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<PrepoznavanjeGovora | null>(null);
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
  // `fokus` (§6c.0) prisilno isključuje auto-kontekst — u Fokus tabu je AI chat SAM ceo centralni
  // sadržaj (`#tt-main-content` bi čitao sopstveni razgovor, rizik izbegnut isto kao ranije).
  const isUnlabeledHome = fokus || !activeTab || activeTab.label === homeLabel;
  const autoContext = !isUnlabeledHome && dismissedForPath !== activePath ? activeTab!.label : null;
  // Čipovi za prikaz/slanje = automatski kontekst taba (ako nije uklonjen) + deljena lista ručno
  // priloženih stavki (dopuna v1.40/§6c.1a) — auto-kontekst se NE dupira ako je korisnik već
  // ručno dodao isti naziv preko "Trenutno otvoren zapis".
  const manualLabels = new Set(contextItems.filter((i): i is Extract<AiContextItem, { type: 'RECORD' }> => i.type === 'RECORD').map((i) => i.refLabel));
  const effectiveContextLabels = [...(autoContext && !manualLabels.has(autoContext) ? [autoContext] : []), ...contextItems.map(itemLabel)];

  // Isti obrazac kao u `Sidebar.tsx` (6.9.2026, dok. 41): uklonjen čip konteksta važi za JEDAN
  // tab, pa se prelaskom na drugi poništava. Podešavanje u renderu, ne u efektu — inače se
  // novi tab na trenutak iscrta sa nasleđenim „uklonjeno" stanjem.
  const [poslednjaPutanja, setPoslednjaPutanja] = useState(activePath);
  if (poslednjaPutanja !== activePath) {
    setPoslednjaPutanja(activePath);
    setDismissedForPath(null);
  }

  // Vidljiv tekst trenutnog taba, automatski prilagan na svaku poruku (22.8.2026, na zahtev
  // vlasnika, posle uživo razjašnjenja — "AI treba da može da vidi sadržaj u centralnom panelu").
  // `#tt-main-content` (Shell.tsx) obuhvata sadržaj CENTRALNOG taba — dokovan AiChatBox (u
  // RightPanel-u) je NJEGOV sused u DOM-u, nema rizika da pročita sopstvenu istoriju. U Fokus
  // tabu (§6c.0) AiChatBox JE `#tt-main-content` sadržaj — `fokus` iznad to prisilno isključuje
  // pre ovog poziva. Isto pravilo uklanjanja kao naziv taba: X na čipu (`dismissedForPath`)
  // prekida i ovo za taj tab, ne samo labelu. Klijentsko sečenje je pogodnost (manji payload) —
  // server ionako ponovo seče (`PAGE_CONTENT_MAX_CHARS`, omnisearch.service.ts), odbrana u dubinu.
  function readPageContent(): string | undefined {
    if (fokus || dismissedForPath === activePath) return undefined;
    const text = document.getElementById('tt-main-content')?.innerText?.trim();
    return text ? text.slice(0, 8000) : undefined;
  }

  async function send(overrideText?: string) {
    const question = (overrideText ?? input).trim();
    if (!question) return;
    const pageContent = readPageContent();
    // `contextItems` (dopuna v1.40, M15 spec §6.5.4.3) — auto-kontekst taba ulazi kao RECORD
    // stavka, OSIM kad ruta ima pravi `filter_list` pogled (§6.5.4.3 ispravka 25.8.2026,
    // `filterableViewForPath` iznad — "koliko rezervacija ima u listi" je ranije dobijalo
    // "ne vidim sadržaj ekrana" jer agent nije znao da "Lista rezervacija" znači `bookings`
    // pogled) — tad postaje FILTERED_LIST sa praznim filterima ("ceo spisak"), isti mehanizam
    // kao dugme "Dodaj u AI kontekst" na traci filtera. Najviše JEDNA FILTERED_LIST stavka po
    // zahtevu (§6.5.4.3) — ako je korisnik već ručno priložio jednu, auto-kontekst ostaje RECORD
    // da ne izgubi svoju referencu tiho (server bi drugu FILTERED_LIST samo preskočio uz log).
    const autoView = autoContext ? filterableViewForPath(activePath) : null;
    const autoAsFilteredList = autoView && !contextItems.some((i) => i.type === 'FILTERED_LIST');
    const sentContextItems = [
      ...(autoContext && !manualLabels.has(autoContext)
        ? [
            autoAsFilteredList
              ? { type: 'FILTERED_LIST' as const, view: autoView!, filters: {}, label: autoContext }
              : { type: 'RECORD' as const, refLabel: autoContext },
          ]
        : []),
      ...contextItems.map((i) => {
        if (i.type === 'RECORD') return { type: 'RECORD' as const, refLabel: i.refLabel };
        if (i.type === 'FILE') return { type: 'FILE' as const, label: i.label, content: i.content };
        if (i.type === 'IMAGE') return { type: 'IMAGE' as const, label: i.label, imageData: i.imageData, imageMediaType: i.imageMediaType };
        return { type: 'FILTERED_LIST' as const, view: i.view, filters: i.filters, resultCount: i.resultCount, label: i.label };
      }),
    ];
    // Istorija (25.8.2026, uživo — vlasnik je primetio da "da" posle pitanja o konkretnoj
    // rezervaciji dobija potpuno nepovezan odgovor, jer je svaki poziv bio izolovan razgovor).
    // Isti obrazac kao TerminalPanel.tsx (BiTerminalAgent, 23.8.2026) — samo tura sa stvarnim
    // odgovorom (ne učitavanje/neaktivno) ima šta da doprinese, server ionako seče na poslednjih 6.
    const history = turns.filter((t) => t.answer && !t.loading).map((t) => ({ question: t.question, answer: t.answer! }));
    setInput('');
    clearContextItems();
    setTurns((t) => [...t, { question, contextLabels: effectiveContextLabels, links: [], loading: true, inactive: false }]);

    try {
      const res = await fetch('/api/omnisearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, pageContent, contextItems: sentContextItems, history }),
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
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) send(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    // `fokus` (dopuna 25.8.2026, na zahtev vlasnika: "polje za chat i odgovore prikazite na 70%
    // sirine ekrana na kom se prikazuje") — SAMO u Fokus tabu (`/ai-asistent`), gde bi razgovor
    // inače razvučen preko cele širine ekrana bio teže čitljiv; dokovan prikaz u desnom panelu
    // već ima svoju (užu, ručno podesivu) širinu, ovo se na njega ne primenjuje.
    <div className={`flex h-full flex-col ${fokus ? 'mx-auto w-[70%]' : ''}`}>
      {/* Dopuna 25.8.2026, na zahtev vlasnika: "Poruke idu odozdo ka gore" + red za unos na dno
          panela. UVEK montirano (ne `{turns.length > 0 && ...}`) — ako se prazan uslov ukloni iz
          DOM-a, nema `flex-1` elementa koji popunjava prostor, pa red za unos "isplivava" na vrh
          umesto da ostane pri dnu (tačno bag prijavljen uživo, snimak ekrana). `flex-col-reverse`
          + `[...turns].reverse()` — najnovija tura je PRVO dete u DOM-u, `flex-col-reverse` je
          crta na DNU (najbliže polju za unos), stariji razgovor raste NAGORE; scroll pozicija
          prirodno ostaje "prilepljena" za najnoviju poruku bez ručnog scrollIntoView-a. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-3 overflow-y-auto py-2">
          {[...turns].reverse().map((t, i) => (
            <div key={turns.length - 1 - i} className="flex flex-col gap-1.5">
              {t.contextLabels && t.contextLabels.length > 0 && (
                <div className="self-end text-[11px] italic text-ink-faint">kontekst: {t.contextLabels.join(' · ')}</div>
              )}
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
      </div>

      {effectiveContextLabels.length > 0 && (
        <div className="mx-2 mt-2 flex flex-wrap items-center gap-1.5">
          {autoContext && !manualLabels.has(autoContext) && (
            <div className="flex items-center gap-1.5 self-start rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] text-ink">
              <Icon name="link" />
              {autoContext}
              <button onClick={() => setDismissedForPath(activePath)} title="Ukloni kontekst" className="ml-0.5 hover:text-danger">
                <Icon name="close" />
              </button>
            </div>
          )}
          {contextItems.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 self-start rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] text-ink">
              <Icon name={item.type === 'FILTERED_LIST' ? 'filter' : item.type === 'FILE' ? 'file' : item.type === 'IMAGE' ? 'file-media' : 'symbol-number'} />
              {itemLabel(item)}
              <button onClick={() => removeContextItem(item.id)} title="Ukloni iz konteksta" className="ml-0.5 hover:text-danger">
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}

      {fileUploadError && (
        <div className="mx-2 mt-1 flex items-center justify-between gap-2 rounded border border-danger bg-danger-bg px-2 py-1 text-[11px] text-danger">
          <span>{fileUploadError}</span>
          <button onClick={() => setFileUploadError(null)} title="Zatvori">
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
          crtao liniju oko gornjeg (unos) reda, što nije bilo traženo. Red za unos je od tada bio
          bez ikakvog okvira (donji red brzih prečica, koji je nosio pun okvir, je od dopune
          25.8.2026/§6c.0a uklonjen).

          ČETVRTI ZAHTEV (25.8.2026, na zahtev vlasnika, uz snimak ekrana): "dodajte samo jednu
          tanku donju liniju polja" — tumačeno doslovno kao linija SAMOG tekstualnog polja
          (Material-stil podvučen unos), ne okvir oko cele trake ikonica — `border-b` je na
          `<input>` elementu ispod (isti `ink-faint` ton kao ostale linije chata iznad). */}
      <div className="flex flex-shrink-0 items-center gap-2 px-2 py-2">
        <div ref={plusRef} className="relative">
          <button
            onClick={() => {
              if (!plusOpen && plusRef.current) {
                const rect = plusRef.current.getBoundingClientRect();
                setPlusMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
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
              `absolute`/`bottom-full` klasa (te su relativne u odnosu na roditelja, tačno ono što
              je izlagalo meni sečenju). `z-50` ovde je odbrana u dubinu — portal na kraju
              `<body>` već prirodno crta iznad ostatka stranice bez toga. Otvara se NAGORE
              (`bottom`, ne `top`) — dopuna 25.8.2026, red za unos je sad pri dnu panela. */}
          {plusOpen &&
            plusMenuPos &&
            createPortal(
              <div
                style={{ bottom: plusMenuPos.bottom, left: plusMenuPos.left }}
                className="fixed z-50 w-56 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg"
              >
                <button
                  disabled={isUnlabeledHome}
                  onClick={() => {
                    if (activeTab) addRecord(activeTab.label);
                    setPlusOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Icon name="file" /> Trenutno otvoren zapis{!isUnlabeledHome ? ` — ${activeTab!.label}` : ''}
                </button>
                <button
                  disabled={!isSearchTab}
                  onClick={() => {
                    addRecord('rezultati trenutne pretrage');
                    setPlusOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Icon name="search" /> Rezultati trenutne pretrage
                </button>
                {/* v1.43 (25.8.2026, na zahtev vlasnika) — prilog dokumenta ILI slike. Jedan
                    skriven input pokriva oba (accept lista + slika ekstenzije), grananje po
                    MIME tipu je u handleFilesSelected iznad. */}
                <button
                  disabled={atCapacity}
                  onClick={() => {
                    fileInputRef.current?.click();
                    setPlusOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Icon name="cloud-upload" /> Priloži fajl ili sliku
                </button>
              </div>,
              document.body,
            )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={`${DOCUMENT_FILE_ACCEPT},image/*`}
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        {/* §6c.0a (dopuna 25.8.2026, na zahtev vlasnika) — "oznaka za kontekst" koja otvara SVE
            module (ulogom filtrirano, `/api/nav-items`) u popup meniju, isti razlog za otvaranje
            NAGORE kao `+` meni iznad. Klik na modul otvara ga (isti `openTab` mehanizam kao
            Sidebar/CommandPalette) i zatvara meni. */}
        <div ref={moduleButtonRef} className="relative">
          <button
            onClick={() => {
              if (!modulePickerOpen && moduleButtonRef.current) {
                const rect = moduleButtonRef.current.getBoundingClientRect();
                setModulePickerPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
              }
              setModulePickerOpen((v) => !v);
            }}
            title="Otvori modul"
            className={`flex h-[31px] w-[31px] items-center justify-center rounded ${modulePickerOpen ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2 hover:text-ink'}`}
          >
            <Icon name="list-tree" />
          </button>
          {modulePickerOpen &&
            modulePickerPos &&
            createPortal(
              <div
                style={{ bottom: modulePickerPos.bottom, left: modulePickerPos.left }}
                className="fixed z-50 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-panel py-1 text-xs shadow-lg"
              >
                {moduleItems.length === 0 && <p className="px-3 py-2 text-ink-faint">Učitavanje...</p>}
                {/* Grupisano po `NAV_GROUPS` (25.8.2026, na zahtev vlasnika — snimak ekrana: "boldirajte
                    osnovne stavke i neka budu bez linka. Otvaraju se samo podlinkovi") — isti obrazac kao
                    Sidebar/ActivityBar: naziv grupe je podebljan, NIJE klikabilan (nema svoju rutu), samo
                    stavke unutar nje otvaraju modul. Prazne grupe (korisnik nema nijedno pravo unutra) se
                    ne prikazuju. */}
                {NAV_GROUPS.map((group) => {
                  const groupItems = moduleItems.filter((i) => group.itemIds.includes(i.id));
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group.id}>
                      <div className="flex items-center justify-between gap-2 py-1.5 pl-3 pr-1.5 font-semibold text-ink">
                        <span className="flex items-center gap-2">
                          <Icon name={group.icon} /> {group.label}
                        </span>
                        {/* "#" (dopuna 25.8.2026, na zahtev vlasnika, uz snimak ekrana: "pored
                            naziva modula dodajte oznaku # ... klikne se... modul treba da se
                            unese u AI chat kao kontekst") — isti mehanizam/ikonica kao
                            `AddToAiContextButton.tsx` (redovi tabela) — ovde primenjen na CEO
                            modul (grupu), ne pojedinačan zapis. Ne zatvara popup — korisnik može
                            dodati više modula pre navigacije/pitanja. */}
                        <button
                          onClick={() => addRecord(`Modul: ${group.label}`)}
                          disabled={atCapacity}
                          title={atCapacity ? 'Najviše 8 zapisa u AI kontekstu odjednom' : `Dodaj modul "${group.label}" u AI kontekst`}
                          className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded font-normal text-ink-faint hover:bg-panel-2 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Icon name="symbol-number" />
                        </button>
                      </div>
                      {/* "#" i na pojedinačnim stavkama, ne samo na nazivu modula (dopuna
                          25.8.2026, na zahtev vlasnika: "oznaku za kontekst stavite i u podmeni
                          stavke") — isti mehanizam kao grupa iznad, samo dodaje POJEDINAČNU
                          sekciju (npr. "Kalendar rezervacija"), ne ceo modul. Ne navigira, ne
                          zatvara popup — razlika od klika na ostatak reda. */}
                      {groupItems.map((item) => (
                        <div key={item.id} className="group flex w-full items-center justify-between gap-1 pl-7 pr-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink">
                          <button
                            onClick={() => {
                              openTab(item.href, item.label);
                              setModulePickerOpen(false);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                          >
                            <Icon name={item.icon} /> <span className="truncate">{item.label}</span>
                          </button>
                          <button
                            onClick={() => {
                              // Ispravka 25.8.2026 (uživo nalaz) — stavka sa pravim `filter_list`
                              // pogledom (npr. "Lista rezervacija" → `bookings`) ulazi kao
                              // FILTERED_LIST (prazni filteri = ceo spisak), ne obična RECORD
                              // referenca — agent tad ima deterministički signal da pozove
                              // filter_list umesto da traži "sadržaj ekrana" koji ne postoji.
                              const view = filterableViewForPath(item.href);
                              if (view && !contextItems.some((i) => i.type === 'FILTERED_LIST')) {
                                addFilteredList({ view, filters: {}, label: item.label });
                              } else {
                                addRecord(item.label);
                              }
                            }}
                            disabled={atCapacity}
                            title={atCapacity ? 'Najviše 8 zapisa u AI kontekstu odjednom' : `Dodaj "${item.label}" u AI kontekst`}
                            className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded text-ink-faint opacity-0 hover:bg-panel hover:text-accent focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Icon name="symbol-number" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>,
              document.body,
            )}
        </div>
        <Icon name="sparkle" className="text-accent" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          onPaste={handlePasteImage}
          placeholder={listening ? 'Slušam...' : 'Pitaj AI ili traži rezervaciju/proizvod...'}
          className="flex-1 border-b border-ink-faint bg-transparent px-1 pb-1 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        {/* Mikrofon POSLE polja, neposredno ispred strelice (dopuna 25.8.2026, na zahtev
            vlasnika: "mikrofon stavite ispred strelice") — ranije je bio pre polja. */}
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
        <button
          onClick={() => send()}
          title="Pošalji"
          className="flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded hover:bg-panel-2"
        >
          <SendArrowIcon />
        </button>
      </div>
    </div>
  );
}
