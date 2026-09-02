import Icon from '@/components/Icon';

// Sažetak na vrhu kartice "Pregled" (2.9.2026, dizajn dok. §6h — na zahtev vlasnika: "da li
// smatrate da je ovo malo teško za oko šta gde da gleda jer je vizuelno sve isto").
//
// Ovo je JEDINI deo ekrana kome je dozvoljeno da bude krupan. Ostatak Pregleda je namerno tiši —
// hijerarhija ne nastaje time što se nešto pojača, nego time što se sve ostalo ne pojačava.
// Sadrži tačno ono što se traži u prve dve sekunde otvaranja rezervacije: koja je, za koga, kada
// se putuje, koliko ljudi, koliko košta i koliko je ostalo da se plati.

export interface HeroFact {
  label: string;
  value: string;
  /** Sitan tekst ispod vrednosti — jedinica, broj stavki, uputstvo šta dalje. */
  note?: string;
  /** `warn` se koristi ISKLJUČIVO kad stanje traži nečiju radnju (npr. preplaćeno), ne za svaki
   * iznos različit od nule — inače boja upozorenja izgubi značenje. */
  tone?: 'default' | 'warn' | 'danger';
  /** Datumi i slično: čitljiviji su u manjoj veličini nego iznosi, jer su duži. */
  compact?: boolean;
}

export default function BookingOverviewHero({
  bookingNumber,
  subtitle,
  badges,
  facts,
}: {
  bookingNumber: string;
  subtitle: string;
  badges: { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }[];
  facts: HeroFact[];
}) {
  return (
    <div className="mb-5 rounded-lg border border-border bg-panel p-4">
      <div className="mb-3.5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-base font-semibold text-ink">
            <span className="text-accent">$</span>
            <span className="truncate">{bookingNumber}</span>
          </div>
          {/* Vlasnik/zaduženi ostaju VIDLJIVI kao podatak — sa vrha ekrana su sklonjene samo
              njihove forme za prenos (kartica Ownership), jer se koriste retko a zauzimale su
              najvredniji deo prvog ekrana. Same radnje su i dalje na istom mestu, ispod. */}
          <div className="mt-0.5 text-[11px] text-ink-faint">{subtitle}</div>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.label}
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${
                b.tone === 'ok'
                  ? 'bg-ok-bg text-ok'
                  : b.tone === 'warn'
                    ? 'bg-warn-bg text-warn'
                    : b.tone === 'danger'
                      ? 'bg-danger-bg text-danger'
                      : 'bg-panel-2 text-ink-faint'
              }`}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
      {/* `sm:grid-cols-2` pre `lg:grid-cols-5`: na uskom ekranu pet kolona daje brojeve koji se
          prelamaju u dva reda, što ubija upravo ono zbog čega su ovde — čitljivost u jednom
          pogledu. */}
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="mb-0.5 text-[9px] uppercase tracking-[0.1em] text-ink-faint">{f.label}</dt>
            <dd
              className={`font-mono font-semibold leading-tight ${f.compact ? 'text-sm' : 'text-lg'} ${
                f.tone === 'warn' ? 'text-warn' : f.tone === 'danger' ? 'text-danger' : 'text-ink'
              }`}
            >
              {f.value}
            </dd>
            {f.note && <div className="mt-0.5 text-[10px] leading-snug text-ink-faint">{f.note}</div>}
          </div>
        ))}
      </dl>
    </div>
  );
}

// Naslov sekcije u novom izgledu — puna boja teksta umesto dosadašnjeg sitnog prigušenog
// natpisa (u zatečenom izgledu je ono što treba da orijentiše bilo najslabije vidljivo).
//
// Dopuna 2.9.2026, na zahtev vlasnika ("red u kom je naslov sekcije da se nekako drugom
// nijansom boje izdvoji"): naslov više nije samo tekst sa linijom ispod, nego TRAKA u nijansi
// `--panel-2` — istoj koju već koriste zaglavlja tabela i bočni paneli, dakle nije nova boja
// nego postojeći "ovo je zaglavlje, ne sadržaj" signal primenjen i ovde. Traka ide preko cele
// širine sekcije da bi red bio čitljiv kao granica, ne kao natpis koji lebdi iznad sadržaja.
export function SectionHeading({
  title,
  meta,
  action,
  href,
  linkLabel,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  /** Kartica na kojoj se vidi CEO sadržaj ove sekcije — prikazuje se samo kad je spisak
   * skraćen na skrol, da korisnik ima izlaz na pun prikaz umesto da traži skrivene redove. */
  href?: string;
  linkLabel?: string;
}) {
  return (
    <h2 className="mb-2 flex items-center gap-2 rounded-t border-b border-border bg-panel-2 px-2.5 py-1.5 text-[13px] font-semibold text-ink">
      {title}
      {meta && <span className="font-mono text-[10px] font-normal text-ink-faint">{meta}</span>}
      {href && linkLabel && (
        <a href={href} className="ml-auto whitespace-nowrap text-[11px] font-normal text-accent-strong hover:underline">
          {linkLabel} →
        </a>
      )}
      {action && <span className={href && linkLabel ? '' : 'ml-auto'}>{action}</span>}
    </h2>
  );
}

// Sekcija sa više od pet redova se skraćuje na skrol umesto da razvuče ekran (2.9.2026, na
// zahtev vlasnika: "u sektorima gde ima više od 5 redova uvesti nevidljivi skroler i link prema
// tabu gde se nalaze sve informacije za taj sektor").
//
// Skrol traka je NEVIDLJIVA (`tt-scroll-hidden`, globals.css) — Pregled je sažetak, pa siva
// traka uz svaku drugu sekciju vizuelno vraća upravo onu buku zbog koje je ceo ovaj redizajn i
// nastao. Cena skrivene trake je što se ne vidi da sadržaja ima još; zato je link u zaglavlju
// ("svi (12) →") OBAVEZAN uz skraćivanje, a ne ukras — broj u njemu je jedini signal da ispod
// vidljivih redova ima još. Nikad skraćivati bez tog linka.
export const OVERVIEW_ROW_LIMIT = 5;

export function ScrollableRows({ limited, maxHeight, children }: { limited: boolean; maxHeight: string; children: React.ReactNode }) {
  if (!limited) return <>{children}</>;
  return <div className={`tt-scroll-hidden overflow-y-auto ${maxHeight}`}>{children}</div>;
}

// Red u spisku "Povezano" — četiri veze ka drugim modulima (M6/M10/M11/M20) koje su do sada bile
// četiri pune kartice iste težine kao sam aranžman. To su reference, ne sadržaj rezervacije.
export function RelatedRow({
  code,
  title,
  meta,
  href,
  actionLabel,
  children,
}: {
  code: string;
  title: string;
  meta?: React.ReactNode;
  href?: string;
  actionLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded px-2 py-1.5 text-xs hover:bg-panel-2">
      <span className="w-7 flex-shrink-0 font-mono text-[10px] text-ink-faint">{code}</span>
      <span className="min-w-0 flex-1 text-ink-dim">
        {title}
        {meta && <span className="ml-1.5 text-ink-faint">{meta}</span>}
      </span>
      {href && actionLabel && (
        <a href={href} className="flex-shrink-0 whitespace-nowrap text-[11px] text-accent hover:underline">
          {actionLabel} →
        </a>
      )}
      {children}
    </div>
  );
}

export function RelatedIcon({ name }: { name: string }) {
  return <Icon name={name} className="text-accent" />;
}
