'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import SearchCriteriaForm, { valuesFromSearchParams, type SearchCriteriaValues } from './SearchCriteriaForm';
import SearchCriteriaChip from './SearchCriteriaChip';
import { useSearchState } from './SearchStateContext';
import { PRODUCT_ICONS, findIconByTypes, type ProductIconDef } from '@/lib/search-product-types';
import { useSelection } from './SelectionContext';
import { inheritedStayFrom, isPackageMode } from '@/lib/search-package';

// EKRAN PRETRAGE — gornji deo centralnog panela (M5 spec §3.0g.1, dizajn dok. §6d.1).
// Vlasnikova odluka (2.9.2026) seli pretragu iz levog panela u centralni:
//   1. ikonice svih devet vrsta proizvoda, centrirane pri vrhu,
//   2. forma ispod njih, različita po vrsti,
//   3. levi panel ostaje isključivo filterima (SearchSidebarPanel.tsx),
//   4. rezultati ispod (page.tsx, nepromenjeno).
// Time ekran pretrage dobija isti oblik kao ekran zapisa rezervacije — sažetak gore, izbor,
// sadržaj ispod — što je vlasnik i tražio ("da vizuelno izgleda slično kao forma za rezervaciju").

/** Query parametri koji pripadaju JEDNOJ vrsti proizvoda — pamte se i vraćaju pri prelasku (§3.0g.4). */
const CRITERIA_KEYS = [
  'destinationCountry', 'destinationCity', 'stayFrom', 'stayTo', 'adults', 'children',
  'cabinClass', 'minDriverAge', 'durationNights', 'cabinType', 'tripType', 'originCity',
  'returnDate', 'flightLegs', 'rooms',
  // Filteri iz levog panela — i oni su "ono što je korisnik uneo za ovu vrstu", pa se pamte
  // zajedno sa kriterijumima; §3.0g.1 tačka 3 ionako traži da se filteri menjaju po vrsti.
  'priceMin', 'priceMax', 'availability', 'boardTypes', 'amenityTags',
];

function typeKeyOf(types: string[]): string {
  return [...types].sort().join('+');
}

/** Izvlači kriterijume tekuće vrste iz adrese, kao query string bez `type`. */
function criteriaFromParams(sp: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const key of CRITERIA_KEYS) {
    for (const value of sp.getAll(key)) out.append(key, value);
  }
  return out.toString();
}

function urlFor(types: string[], criteria: string): string {
  const next = new URLSearchParams(criteria);
  for (const t of types) next.append('type', t);
  return `/rezervacije/pretraga?${next.toString()}`;
}

export default function SearchPanel({ hasResults }: { hasResults: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { criteriaFor, rememberCriteria, forgetCriteria, armRefresh } = useSearchState();
  const { items } = useSelection();

  const types = sp.getAll('type');
  const activeIcon = findIconByTypes(types);
  const typeKey = typeKeyOf(types);
  // M5 spec §3.0d.5a — „Individualni paketi" je jedan prekidač, ne poseban ekran: dok je
  // uključen, svaka sledeća pretraga preuzima datum poslednje stavke iz desnog panela.
  const packageMode = isPackageMode(sp);
  const criteria = criteriaFromParams(new URLSearchParams(sp.toString()));

  // §3.0g.2 — forma je otvorena dok nema rezultata; čim stignu, skuplja se u red sa kriterijumima.
  // `expanded` je override koji korisnik uključuje dugmetom "+" na tom redu.
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // §3.0g.4 — svaki put kad se adresa promeni, upamti kriterijume TEKUĆE vrste, da bi imali šta
  // da vratimo kad se korisnik na nju vrati posle rada na drugoj vrsti.
  useEffect(() => {
    if (types.length > 0 && criteria) rememberCriteria(typeKey, criteria);
  }, [typeKey, criteria]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dizajn dok. §6d.1 (vlasnikova odluka) — dok korisnik gleda rezultate jedne vrste, ekrani
  // ostalih vrsta se povlače u pozadini, pa je prelazak trenutan. Ne odnosi se na same rezultate
  // (oni zavise od onoga što se tek unese), samo na kod ekrana.
  useEffect(() => {
    for (const p of PRODUCT_ICONS) {
      if (p.locked || p.types.length === 0) continue;
      router.prefetch(urlFor(p.types, criteriaFor(typeKeyOf(p.types)) ?? ''));
    }
  }, [typeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Čim stignu rezultati, red se skuplja sam (§3.0g.2). Ako korisnik promeni vrstu proizvoda i
  // za nju nema upamćenih kriterijuma, forma se otvara — nema šta da se skuplja.
  useEffect(() => {
    setExpanded(false);
  }, [typeKey, criteria]);

  /** §3.0d.5a — uključuje/isključuje praćenje datuma; ne menja vrstu pretrage niti briše išta. */
  function togglePackageMode() {
    const next = new URLSearchParams(sp.toString());
    if (packageMode) next.delete('paket');
    else next.set('paket', '1');
    router.push(`/rezervacije/pretraga?${next.toString()}`);
  }

  function selectType(p: ProductIconDef) {
    if (p.packageMode) {
      togglePackageMode();
      return;
    }
    if (p.locked || p.types.length === 0) return;
    const target = typeKeyOf(p.types);
    if (target === typeKey) {
      setExpanded((v) => !v);
      return;
    }
    // §3.0g.4 — kriterijumi prethodne vrste se NE brišu; ako izabrana vrsta ima upamćene
    // kriterijume, vraćaju se u adresu i rezultati se ponovo prikazuju sami.
    if (criteria) rememberCriteria(typeKey, criteria);

    const nextCriteria = new URLSearchParams(criteriaFor(target) ?? '');
    // §3.0d.5a — datum se PREUZIMA samo u prazno polje: već unet datum ostaje netaknut, inače bi
    // uključen paket tiho pomerao ono što je korisnik pažljivo podesio. Prazna selekcija znači
    // da nema od čega da se nasledi — prekidač tada ne radi ništa, i to je tačno.
    if (packageMode && !nextCriteria.get('stayFrom')) {
      const inherited = inheritedStayFrom(items[items.length - 1]);
      if (inherited) nextCriteria.set('stayFrom', inherited);
    }
    if (packageMode) nextCriteria.set('paket', '1');
    router.push(urlFor(p.types, nextCriteria.toString()));
  }

  function reset() {
    forgetCriteria(typeKey);
    router.push(urlFor(types, ''));
    setExpanded(true);
  }

  function refresh() {
    setRefreshing(true);
    armRefresh(typeKey);
    router.refresh();
    // Server komponenta se ponovo učitava; poređenje i traka sa razlikom idu kroz
    // SearchRefreshNotice.tsx, koji dobija nove ponude iz page.tsx.
    setTimeout(() => setRefreshing(false), 1200);
  }

  const showForm = expanded || !hasResults || !activeIcon;

  return (
    <div className="mb-4">
      {/* 1. Devet ikonica, centrirano pri vrhu centralnog panela (§3.0g.1 tačka 1). Postavlja se
             svih devet i onda kad pet nema izvor podataka — poruka umesto prazne liste je u
             page.tsx (§3.0g.5), ne izostavljena ikonica.

             Dopuna 4.9.2026 (na zahtev vlasnika: "ikone povećajte za 20% i približite ih jedne
             drugima za 20%"): razmak se meri od CENTRA do centra ikonice, ne po `gap`-u — `gap`
             je već bio 4px, pa bi -20% na njemu bilo nevidljivo. Šire dugme je ono što ih je
             držalo razdvojenim: 6rem + 0.25rem = 100px između centara → 4.75rem + 0.25rem = 80px,
             tačno -20%. Tanka linija ispod je istog dana dodata pa uklonjena na vlasnikov poziv
             ("višak je ipak") — razmak sam dovoljno odvaja izbor vrste od forme pod njim. */}
      <div className="mb-4 flex flex-wrap items-start justify-center gap-1">
        {PRODUCT_ICONS.map((p) => {
          const active = p.packageMode ? packageMode : p.types.length > 0 && typeKeyOf(p.types) === typeKey;
          const disabled = p.packageMode ? false : Boolean(p.locked) || p.types.length === 0;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => selectType(p)}
              disabled={disabled}
              title={
                p.packageMode
                  ? 'Individualni paket — svaka sledeća usluga preuzima datum poslednje dodate stavke (M5 §3.0d.5a)'
                  : (p.locked ?? p.label)
              }
              className={`flex w-[4.75rem] flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-[11px] leading-none transition-colors ${
                disabled
                  ? 'cursor-not-allowed text-ink-faint opacity-40'
                  : active
                    ? 'bg-accent-soft text-accent-strong ring-1 ring-accent'
                    : 'text-ink-dim hover:bg-panel hover:text-ink'
              }`}
            >
              {/* +20% u odnosu na `text-lg` (18px → 21.6px), 4.9.2026 na zahtev vlasnika. */}
              <Icon name={p.icon} className="text-[1.35rem]" />
              <span className="text-center">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Forma ispod ikonica, u centralnom panelu, različita po vrsti (§3.0g.1 tačka 2) —
             ili skupljen red sa kriterijumima kad rezultati postoje (§3.0g.2). */}
      {packageMode && (
        <p className="mb-3 text-center text-[11px] text-accent-strong">
          {items.length > 0
            ? `Individualni paket: sledeća usluga kreće od ${inheritedStayFrom(items[items.length - 1]) || 'datuma poslednje stavke'}. Datum koji sami unesete ostaje.`
            : 'Individualni paket: čim dodate prvu stavku u desni panel, sledeća usluga preuzima njen datum.'}
        </p>
      )}

      {activeIcon && showForm && (
        <SearchCriteriaForm
          label={activeIcon.label}
          types={activeIcon.types}
          initialValues={valuesFromSearchParams(sp) as SearchCriteriaValues}
          onSubmitted={() => setExpanded(false)}
          onCancel={hasResults ? () => setExpanded(false) : undefined}
        />
      )}

      {activeIcon && !showForm && (
        <SearchCriteriaChip onExpand={() => setExpanded(true)} onReset={reset} onRefresh={refresh} refreshing={refreshing} />
      )}

      {!activeIcon && (
        <p className="text-center text-xs text-ink-faint">Izaberite vrstu proizvoda iznad da biste pokrenuli pretragu.</p>
      )}
    </div>
  );
}
