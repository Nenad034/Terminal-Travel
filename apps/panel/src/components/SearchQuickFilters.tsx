'use client';

import Icon from './Icon';
import { useSearchFilters } from './SearchFiltersContext';

// BRZI FILTERI — vodoravna traka iznad rezultata u centralnom panelu (M5 spec §3.0c.3a/§3.0c.3c,
// dizajn dok. §6d).
//
// Gde stoje i zašto tu. Specifikacija ih je od 18.8.2026 predviđala „pinovane na vrhu sekcije
// Filteri" u LEVOM panelu. Vlasnik je 3.9.2026 odlučio drugačije: idu u vodoravnu traku iznad
// rezultata, uz sortiranje. Razlog je isti onaj iz §3.0c.3a zbog kog su uopšte izdvojeni —
// najčešće su odlučujući pri prodaji ("da li se otkazuje bez penala", "koja kategorija"), pa
// treba da budu u vidokrugu čoveka koji gleda u listu, a ne u koloni sa dvadesetak drugih
// tagova kroz koju se skroluje.
//
// Pravilo koje se drži (isto kao kod sortiranja, §3.0g.8): nudi se ISKLJUČIVO ono za šta
// stvarno postoji podatak. Prekidač se ne prikazuje kao siva, neupotrebljiva dugmad — zato
// `showRefundable`/`showStars` dolaze spolja, iz stranice koja zna šta prikazuje.
//
// Filtriranje je trenutno i klijentsko (§3.0c.3b) — klik menja živo stanje, ne adresu, i ne
// pokreće nov `GET /search`.

const STAR_VALUES = ['1', '2', '3', '4', '5'] as const;

/** Srpska promena broja: 1 zvezdica, 2–4 zvezdice, 5 zvezdica. */
function zvezdice(n: string): string {
  return n === '1' || n === '5' ? 'zvezdica' : 'zvezdice';
}

export default function SearchQuickFilters({
  showRefundable,
  showStars,
}: {
  showRefundable: boolean;
  showStars: boolean;
}) {
  const filters = useSearchFilters();
  if (!showRefundable && !showStars) return null;

  const refundable = filters.get('refundable') ?? '';
  const stars = filters.getAll('stars');

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {showRefundable && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-ink-faint">
            <Icon name="filter" /> otkazivanje:
          </span>
          <div className="flex flex-wrap gap-1">
            {[
              { value: '', label: 'svejedno' },
              { value: 'REFUNDABLE', label: 'refundabilno' },
              { value: 'NON_REFUNDABLE', label: 'nerefundabilno' },
            ].map((o) => (
              <button
                key={o.value || 'any'}
                type="button"
                onClick={() => filters.setScalar('refundable', o.value)}
                aria-pressed={refundable === o.value}
                className={`rounded-full border px-2 py-0.5 ${
                  refundable === o.value
                    ? 'border-accent bg-accent-soft font-semibold text-accent-strong'
                    : 'border-border text-ink-dim hover:border-accent hover:text-ink'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showStars && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-ink-faint">kategorija:</span>
          {/* Jedan tag sa pet zvezdica (vlasnikov opis, 3.9.2026), ali PET NEZAVISNIH prekidača,
              ne skala „N i više": klik na drugu i treću daje hotele sa 2 i sa 3 zvezdice. Zato
              zvezdice stoje kao odvojena dugmad sa razmakom, a izabrana dobija sopstvenu
              akcentnu podlogu — da se red ne pročita kao popunjena ocena. `title`/`aria-label`
              to i kažu rečima, za slučaj da vizuelno ostane dvosmisleno. */}
          <div
            role="group"
            aria-label="kategorija (zvezdice)"
            className="flex items-center gap-0.5 rounded-full border border-border px-1 py-0.5"
          >
            {STAR_VALUES.map((v) => {
              const on = stars.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => filters.toggleMulti('stars', v)}
                  aria-pressed={on}
                  title={`samo ${v} ${zvezdice(v)}`}
                  aria-label={`kategorija ${v}`}
                  className={`rounded-full px-1.5 py-0.5 leading-none ${
                    on ? 'bg-accent-soft text-accent-strong' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  {on ? '★' : '☆'}
                </button>
              );
            })}
          </div>
          {stars.length > 0 && (
            // Bez ovoga se izabrana kategorija čita samo iz oblika zvezdice (★ naspram ☆) —
            // premala razlika da bi sama nosila stanje filtera.
            <span className="text-ink-faint">
              {[...stars].sort().join(', ')} {stars.length === 1 ? zvezdice(stars[0]) : 'zvezdice'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
