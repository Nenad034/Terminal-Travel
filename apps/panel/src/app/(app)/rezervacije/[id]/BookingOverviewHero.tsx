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
  holderName,
  subtitle,
  badges,
  facts,
}: {
  bookingNumber: string;
  /** Nosilac rezervacije (2.9.2026, na zahtev vlasnika: "ime i prezime nosioca rezervacije
   * treba da piše boldiranim slovima i većim fontom"). Izdvojen iz `subtitle` u sopstveni red
   * — to je ime po kom se rezervacija traži i po kom se gost javlja telefonom, pa ne sme da
   * stoji u istom sitnom nizu sa imenima kolega koji su vlasnik/zaduženi. */
  holderName: string | null;
  subtitle: string;
  badges: { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }[];
  facts: HeroFact[];
}) {
  // Sažetak stoji na "utonuloj" površini (2.9.2026, na zahtev vlasnika: "centralni sektor
  // unutra u tamnijoj nijansi") — ista uloga kao traka naslova sekcije ispod: to je okvir oko
  // podataka, ne sami podaci. Sadržaj sekcija je jedina površina koja se "diže".
  return (
    <div className="mb-5 rounded-lg border border-border bg-sunken p-4">
      <div className="mb-3.5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-base font-semibold text-ink">
            <span className="text-accent">$</span>
            <span className="truncate">{bookingNumber}</span>
          </div>
          {/* Nosilac rezervacije je krupniji i podebljan — jedini deo zaglavlja koji nije ni
              šifra ni sitan tekst. Broj rezervacije se koristi za pretragu i dopisivanje, ali
              čovek pamti IME; zato ime stoji odmah ispod broja i čita se prvo. */}
          {holderName && <div className="mt-1 text-[15px] font-semibold leading-tight text-ink">{holderName}</div>}
          {/* Vlasnik/zaduženi ostaju VIDLJIVI kao podatak — sa vrha ekrana su sklonjene samo
              njihove forme za prenos (kartica Ownership), jer se koriste retko a zauzimale su
              najvredniji deo prvog ekrana. Same radnje su i dalje na istom mestu, ispod. */}
          {subtitle && <div className="mt-0.5 text-[11px] text-ink-faint">{subtitle}</div>}
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
  linkTitle,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  /** Kartica na kojoj se vidi CEO sadržaj ove sekcije. Dopuna 2.9.2026, na zahtev vlasnika
   * ("kod svakog sektora postaviti ikonu linka da se taj sektor u celosti otvori u odgovarajućem
   * tabu"): ikona stoji na SVAKOJ sekciji koja ima svoju karticu, ne samo na skraćenima —
   * Pregled je sažetak, pa izlaz na pun prikaz treba da bude na istom mestu kod svake sekcije,
   * a ne da se pojavljuje i nestaje u zavisnosti od broja redova. */
  href?: string;
  /** Tekst uz ikonu — prikazuje se SAMO kad je spisak skraćen na skrol (`svi (12)`). Pošto je
   * skrol traka nevidljiva, taj broj je jedini signal da ispod vidljivih redova ima još. */
  linkLabel?: string;
  /** Naziv kartice — ulazi u `title`/`aria-label`, jer je ikona sama po sebi bez teksta. */
  linkTitle?: string;
}) {
  return (
    <h2 className="flex items-center gap-2 border-b border-border bg-sunken px-2.5 py-1.5 text-[13px] font-semibold text-ink">
      {title}
      {meta && <span className="font-mono text-[10px] font-normal text-ink-faint">{meta}</span>}
      {href && (
        <a
          href={href}
          title={linkTitle ?? 'Otvori sekciju u celosti'}
          // `Icon` je `aria-hidden`, pa link bez ovoga nema ime za čitač ekrana — bila bi
          // veza koju korisnik tastature otvori ne znajući gde vodi.
          aria-label={linkTitle ?? 'Otvori sekciju u celosti'}
          className="ml-auto flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-normal text-accent-strong hover:underline"
        >
          {linkLabel}
          <Icon name="link-external" />
        </a>
      )}
      {action && <span className={href ? '' : 'ml-auto'}>{action}</span>}
    </h2>
  );
}

// Sekcija kartice Pregled kao JEDAN objekat (2.9.2026, na zahtev vlasnika: "naslovni deo tamnija
// nijansa a sadržaj ispod svetlija"). Do sada je traka naslova imala boju a sadržaj ispod nje je
// sedeo direktno na pozadini strane — sekcija je čitala kao "traka, pa ništa", ne kao celina.
//
// Zajednički okvir sa `overflow-hidden` je ono što drži oblik: traka i telo nemaju sopstvena
// zaobljenja nego ih dobijaju od roditelja, pa se ne mogu razići kad se nekoj sekciji promeni
// sadržaj. Telo nosi `bg-panel` (jedina površina koja se "diže"), traka `bg-sunken`.
export function OverviewSection({
  title,
  meta,
  href,
  linkLabel,
  linkTitle,
  children,
}: {
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
  linkTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel">
      <SectionHeading title={title} meta={meta} href={href} linkLabel={linkLabel} linkTitle={linkTitle} />
      <div className="px-2.5 py-2">{children}</div>
    </div>
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
