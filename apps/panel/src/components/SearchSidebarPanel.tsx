'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';

// M5 spec §3.0g.1 / dizajn dok. §6d.1 (vlasnikova odluka, 2.9.2026) — levi panel sadrži
// ISKLJUČIVO filtere. Ikonice devet vrsta proizvoda i sama forma pretrage su se do tada nalazile
// ovde; sad žive u centralnom panelu (SearchPanel.tsx). Razlog je vlasnikov: forma je bila jedan
// zajednički iskačući prozor sa devetak polja za svih devet vrsta, a "ovo nam je među
// najvažnijim modulima, odavde sve kreće".
//
// Filteri se menjaju prema AKTIVNOJ vrsti proizvoda (§3.0g.1 tačka 3) — broj presedanja i
// udaljenost od plaže nemaju šta jedno kraj drugog. "Refundabilno/Nerefundabilno" brzi filter iz
// §6d i dalje nije uključen — `SearchResultOffer.is_refundable` je specificiran (M5 spec v1.32)
// ali nikad implementiran na `search.service.ts` — zahteva zaseban prolaz (izračunavanje iz
// `CancellationRule` prozora za CONTRACTED, M5 spec §3.0c.3a), zabeleženo u backlogu, ne
// prećutno izostavljeno.
//
// Dopuna (26.8.2026, na zahtev vlasnika: "u levom panelu za smeštaj dodajte još filtera") —
// dva filtera iz M5 spec §3.0c.2/§3.0c.3 koja su bila specificirana ali nikad ožičena:
// "vrsta usluge" (board_type, klijentski filter nad već dobijenim rezultatima, isti princip
// kao "dostupnost" — statičan skup vrednosti, NE ograničen na ono što se stvarno pojavljuje u
// trenutnim rezultatima, isto pojednostavljenje kao postojeći "dostupnost" select) i sadržaji-
// tagovi (`amenity_tags[]`, M2 spec §2.3c `AmenityTag` enum, pravi upitni parametar `GET
// /search`, I-logika na serveru — proizvod mora imati SVE izabrane tagove).
const AMENITY_GROUPS: { label: string; tags: { value: string; label: string }[] }[] = [
  {
    label: 'Udaljenost od plaže',
    tags: [
      { value: 'BEACH_UNDER_50M', label: 'do 50m' },
      { value: 'BEACH_UNDER_100M', label: 'do 100m' },
      { value: 'BEACH_UNDER_250M', label: 'do 250m' },
      { value: 'BEACH_UNDER_500M', label: 'do 500m' },
    ],
  },
  {
    label: 'Bazen',
    tags: [
      { value: 'POOL_OUTDOOR', label: 'spoljni' },
      { value: 'POOL_INDOOR', label: 'zatvoren' },
      { value: 'POOL_HEATED', label: 'grejan' },
      { value: 'POOL_KIDS', label: 'dečji' },
    ],
  },
  {
    label: 'Sadržaji objekta',
    tags: [
      { value: 'WIFI_FREE', label: 'besplatan WiFi' },
      { value: 'PARKING', label: 'parking' },
      { value: 'SPA_WELLNESS', label: 'spa/wellness' },
      { value: 'RESTAURANT', label: 'restoran' },
      { value: 'RECEPTION_24H', label: 'recepcija 24h' },
    ],
  },
  {
    label: 'Pogodno za',
    tags: [
      { value: 'FAMILY_FRIENDLY', label: 'porodice' },
      { value: 'ADULTS_ONLY', label: 'samo odrasli' },
      { value: 'PETS_ALLOWED', label: 'kućni ljubimci' },
    ],
  },
];
const BOARD_TYPES = ['BB', 'HB', 'FB', 'AI', 'UAI'];
export default function SearchSidebarPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const currentTypes = sp.getAll('type');
  const showAccommodationFilters = currentTypes.includes('ACCOMMODATION');

  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-2 pb-3 text-xs">
      {currentTypes.length === 0 && (
        <p className="text-ink-faint">Izaberite vrstu proizvoda u centralnom panelu — filteri se pojavljuju uz aktivnu pretragu.</p>
      )}

      {currentTypes.length > 0 && (
      <form
        className="contents"
        onSubmit={(e) => {
          // Nativan GET submit bi ZAMENIO ceo query string samo poljima ove forme, brišući
          // type/destinaciju/datume iz popup-a — ovde spajamo sa postojećim parametrima umesto
          // toga (isti razlog zašto je ranije bio JEDAN deljeni <form> — sad su odvojeni, ali
          // moraju i dalje da se spajaju, ne zamenjuju).
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const next = new URLSearchParams(sp.toString());
          for (const key of ['priceMin', 'priceMax', 'availability', 'boardType']) {
            const val = String(data.get(key) ?? '');
            if (val) next.set(key, val);
            else next.delete(key);
          }
          next.delete('amenityTags');
          for (const tag of data.getAll('amenityTags')) next.append('amenityTags', String(tag));
          router.push(`/rezervacije/pretraga?${next.toString()}`);
        }}
      >
        <Section title="Filteri" open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)}>
          <label className="text-ink-faint">
            cena od / do
            <div className="mt-1 flex gap-1">
              <input type="number" name="priceMin" min={0} defaultValue={sp.get('priceMin') ?? ''} className="input w-1/2" placeholder="0" />
              <input type="number" name="priceMax" min={0} defaultValue={sp.get('priceMax') ?? ''} className="input w-1/2" placeholder="∞" />
            </div>
          </label>
          <label className="text-ink-faint">
            dostupnost
            <select name="availability" defaultValue={sp.get('availability') ?? ''} className="input mt-1 w-full">
              <option value="">— sve —</option>
              <option value="AVAILABLE">Odmah potvrda</option>
              <option value="ON_REQUEST">Upit</option>
            </select>
          </label>

          {showAccommodationFilters && (
            <>
              <label className="text-ink-faint">
                vrsta usluge
                <select name="boardType" defaultValue={sp.get('boardType') ?? ''} className="input mt-1 w-full">
                  <option value="">— sve —</option>
                  {BOARD_TYPES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-ink-faint">
                sadržaji
                <div className="mt-1 flex flex-col gap-2">
                  {AMENITY_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="mb-1 text-xs uppercase text-ink-faint/70">{group.label}</div>
                      <div className="flex flex-wrap gap-1">
                        {group.tags.map((tag) => (
                          <label
                            key={tag.value}
                            className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[11px] text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong"
                          >
                            <input
                              type="checkbox"
                              name="amenityTags"
                              value={tag.value}
                              defaultChecked={sp.getAll('amenityTags').includes(tag.value)}
                              className="sr-only"
                            />
                            {tag.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <button
            type="submit"
            className="mt-1 flex items-center justify-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 font-semibold text-ink-dim hover:border-accent hover:text-ink"
          >
            <Icon name="filter" /> primeni filtere
          </button>
        </Section>
      </form>
      )}
    </div>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-2 first:border-t-0 first:pt-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1.5 py-1 text-left font-medium text-ink">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} className="text-ink-faint" />
        {title}
      </button>
      {open && <div className="flex flex-col gap-2 pl-1 pt-1">{children}</div>}
    </div>
  );
}
