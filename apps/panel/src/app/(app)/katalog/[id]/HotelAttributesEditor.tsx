'use client';

import { useState } from 'react';
import { saveHotelAttributes } from '../actions';
import { ButtonGroup, ToggleButton } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';

// M2 spec §2.3 (accommodation_type/stars/board_type), §2.3c (amenities[] — kontrolisana
// taksonomija AmenityTag), §2.3d (attributes.contact) — nalaz iz backloga
// (docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md, M2 sekcija, 28.8.2026): ova polja imaju model
// i validaciju na backendu otkad su dodata, ali nikad panel ekran — samo `room_types[]`
// (RoomTypesEditor.tsx) je pokriven. Ovaj editor zatvara taj gap, isti obrazac čuvanja
// (pročitaj-pa-upiši ceo `attributes`, poglavlje "saveRoomTypes" u ../actions.ts) da izmena
// hotelskih polja tiho ne obriše `room_types[]` koji je neko drugi u međuvremenu izmenio.
export type AccommodationType = 'HOTEL' | 'VILA' | 'APARTMAN' | 'HOSTEL' | 'KAMP' | 'KABINA_NA_BRODU' | 'DRUGO';
export type AmenityTag =
  | 'BEACH_UNDER_50M' | 'BEACH_UNDER_100M' | 'BEACH_UNDER_250M' | 'BEACH_UNDER_500M' | 'BEACH_OVER_500M'
  | 'POOL_OUTDOOR' | 'POOL_INDOOR' | 'POOL_HEATED' | 'POOL_KIDS'
  | 'BEACH_SAND' | 'BEACH_PEBBLE' | 'BEACH_ROCK' | 'BEACH_PRIVATE'
  | 'WIFI_FREE' | 'PARKING' | 'GYM' | 'SPA_WELLNESS' | 'RESTAURANT' | 'AIRPORT_SHUTTLE' | 'RECEPTION_24H' | 'ROOM_SERVICE'
  | 'AC' | 'TV' | 'KITCHENETTE' | 'MINIBAR' | 'BALCONY' | 'SEA_VIEW' | 'MOUNTAIN_VIEW'
  | 'FAMILY_FRIENDLY' | 'ADULTS_ONLY' | 'PETS_ALLOWED'
  | 'FREE_CANCELLATION' | 'PAY_AT_PROPERTY' | 'NON_SMOKING';

export interface HotelContact {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface HotelAttributes {
  accommodation_type?: AccommodationType | null;
  stars?: number | null;
  board_type?: string | null;
  amenities?: AmenityTag[];
  contact?: HotelContact | null;
}

const ACCOMMODATION_TYPE_LABELS: Record<AccommodationType, string> = {
  HOTEL: 'Hotel',
  VILA: 'Vila',
  APARTMAN: 'Apartman',
  HOSTEL: 'Hostel',
  KAMP: 'Kamp',
  KABINA_NA_BRODU: 'Kabina na brodu',
  DRUGO: 'Drugo',
};

// M2 spec §2.3c — sedam grupa istražene naspram Booking.com Content API kategorija; lista je
// namerno polazna, ne konačna (spec: "proširuje se pri stvarnoj izradi ekrana... ako se pokaže
// potreba za dodatnom vrednošću"). Ovo JESTE ta stvarna izrada ekrana.
const AMENITY_GROUPS: { label: string; tags: AmenityTag[] }[] = [
  { label: 'Udaljenost od plaže', tags: ['BEACH_UNDER_50M', 'BEACH_UNDER_100M', 'BEACH_UNDER_250M', 'BEACH_UNDER_500M', 'BEACH_OVER_500M'] },
  { label: 'Bazen', tags: ['POOL_OUTDOOR', 'POOL_INDOOR', 'POOL_HEATED', 'POOL_KIDS'] },
  { label: 'Plaža', tags: ['BEACH_SAND', 'BEACH_PEBBLE', 'BEACH_ROCK', 'BEACH_PRIVATE'] },
  { label: 'Sadržaji objekta', tags: ['WIFI_FREE', 'PARKING', 'GYM', 'SPA_WELLNESS', 'RESTAURANT', 'AIRPORT_SHUTTLE', 'RECEPTION_24H', 'ROOM_SERVICE'] },
  { label: 'Soba', tags: ['AC', 'TV', 'KITCHENETTE', 'MINIBAR', 'BALCONY', 'SEA_VIEW', 'MOUNTAIN_VIEW'] },
  { label: 'Pogodno za', tags: ['FAMILY_FRIENDLY', 'ADULTS_ONLY', 'PETS_ALLOWED'] },
  { label: 'Politika', tags: ['FREE_CANCELLATION', 'PAY_AT_PROPERTY', 'NON_SMOKING'] },
];

const AMENITY_LABELS: Record<AmenityTag, string> = {
  BEACH_UNDER_50M: '< 50m', BEACH_UNDER_100M: '< 100m', BEACH_UNDER_250M: '< 250m', BEACH_UNDER_500M: '< 500m', BEACH_OVER_500M: '> 500m',
  POOL_OUTDOOR: 'otvoreni bazen', POOL_INDOOR: 'zatvoreni bazen', POOL_HEATED: 'grejan bazen', POOL_KIDS: 'dečji bazen',
  BEACH_SAND: 'peščana', BEACH_PEBBLE: 'šljunkovita', BEACH_ROCK: 'stenovita', BEACH_PRIVATE: 'privatna plaža',
  WIFI_FREE: 'besplatan WiFi', PARKING: 'parking', GYM: 'teretana', SPA_WELLNESS: 'spa/wellness', RESTAURANT: 'restoran',
  AIRPORT_SHUTTLE: 'prevoz do aerodroma', RECEPTION_24H: 'recepcija 0-24', ROOM_SERVICE: 'room service',
  AC: 'klima', TV: 'TV', KITCHENETTE: 'čajna kuhinja', MINIBAR: 'minibar', BALCONY: 'balkon', SEA_VIEW: 'pogled na more', MOUNTAIN_VIEW: 'pogled na planinu',
  FAMILY_FRIENDLY: 'porodično', ADULTS_ONLY: 'samo odrasli', PETS_ALLOWED: 'ljubimci dozvoljeni',
  FREE_CANCELLATION: 'besplatno otkazivanje', PAY_AT_PROPERTY: 'plaćanje u objektu', NON_SMOKING: 'zabranjeno pušenje',
};

export default function HotelAttributesEditor({ productId, initial }: { productId: string; initial: HotelAttributes }) {
  const [attrs, setAttrs] = useState<HotelAttributes>({
    accommodation_type: initial.accommodation_type ?? null,
    stars: initial.stars ?? null,
    board_type: initial.board_type ?? '',
    amenities: initial.amenities ?? [],
    contact: { phone: initial.contact?.phone ?? '', email: initial.contact?.email ?? '', address: initial.contact?.address ?? '' },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function toggleAmenity(tag: AmenityTag) {
    const current = attrs.amenities ?? [];
    setAttrs({ ...attrs, amenities: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag] });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveHotelAttributes(productId, {
        accommodation_type: attrs.accommodation_type,
        stars: attrs.stars,
        board_type: attrs.board_type?.trim() ? attrs.board_type.trim() : null,
        amenities: attrs.amenities ?? [],
        contact: {
          phone: attrs.contact?.phone?.trim() || null,
          email: attrs.contact?.email?.trim() || null,
          address: attrs.contact?.address?.trim() || null,
        },
      });
      setSavedAt(Date.now());
    } catch {
      setError('Čuvanje nije uspelo. Pokušajte ponovo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Hotelski atributi</h2>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[11px] text-success">sačuvano</span>}
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? 'Čuvanje…' : 'Sačuvaj'}
          </Button>
        </div>
      </div>
      {error && <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">{error}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="Tip objekta">
          <ButtonGroup<AccommodationType>
            value={attrs.accommodation_type ?? null}
            onChange={(v) => setAttrs({ ...attrs, accommodation_type: v })}
            options={(Object.keys(ACCOMMODATION_TYPE_LABELS) as AccommodationType[]).map((v) => ({ value: v, label: ACCOMMODATION_TYPE_LABELS[v] }))}
          />
        </Field>
        <Field label="Kategorija (zvezdice)">
          <ButtonGroup
            value={attrs.stars != null ? String(attrs.stars) : null}
            onChange={(v) => setAttrs({ ...attrs, stars: Number(v) })}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: '★'.repeat(n) }))}
          />
        </Field>
        <Field label="Tip usluge (board type)">
          <input
            className="input text-xs"
            value={attrs.board_type ?? ''}
            onChange={(e) => setAttrs({ ...attrs, board_type: e.target.value })}
            placeholder="npr. all-inclusive, polupansion"
          />
        </Field>
      </div>

      <h3 className="mb-2 text-xs font-semibold text-ink-faint">Sadržaji i pogodnosti</h3>
      <div className="mb-4 flex flex-col gap-2.5">
        {AMENITY_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-[11px] text-ink-faint">{g.label}</p>
            <div className="flex flex-wrap gap-1">
              {g.tags.map((tag) => (
                <ToggleButton key={tag} active={(attrs.amenities ?? []).includes(tag)} onToggle={() => toggleAmenity(tag)} label={AMENITY_LABELS[tag]} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 className="mb-2 text-xs font-semibold text-ink-faint">Kontakt</h3>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Telefon">
          <input className="input text-xs" value={attrs.contact?.phone ?? ''} onChange={(e) => setAttrs({ ...attrs, contact: { ...attrs.contact, phone: e.target.value } })} />
        </Field>
        <Field label="Email">
          <input className="input text-xs" value={attrs.contact?.email ?? ''} onChange={(e) => setAttrs({ ...attrs, contact: { ...attrs.contact, email: e.target.value } })} />
        </Field>
        <Field label="Adresa">
          <input className="input text-xs" value={attrs.contact?.address ?? ''} onChange={(e) => setAttrs({ ...attrs, contact: { ...attrs.contact, address: e.target.value } })} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
