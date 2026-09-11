'use client';

import { useEffect, useState } from 'react';
import { saveRoomTypes } from '../actions';
import { ButtonGroup, ToggleButton } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';

// M2 spec §2.3a/§2.3b/v1.14 (28.8.2026, na zahtev vlasnika: "koja polja sve taj panel treba da
// ima" — nakon nalaza da room_types[]/beds/age_policy[] postoje u modelu od v1.4, ali nemaju
// nijedan panel ekran za unos, samo API). Prvi primer u ovoj kodbazi obrasca "lista objekata +
// modal za dodavanje/izmenu" — nema ranijeg da se prati.
//
// Hotelska (ne-sobna) attributes polja (stars/board_type/amenities/accommodation_type/contact)
// imaju sopstveni editor — vidi HotelAttributesEditor.tsx (dopunjeno 29.8.2026).
export type BaseBedType = 'FRANCUSKI_LEZAJ' | 'DVA_ODVOJENA_KREVETA' | 'BRACNI_KREVET' | 'DRUGO';
export type ExtraBedType = 'RAZVODNI_KREVET' | 'SOFA_KREVET' | 'POMOCNI_LEZAJ' | 'DRUGO';
export type AgeCategory = 'ADULT' | 'CHILD' | 'TEEN' | 'INFANT';

export interface AgePolicyEntry {
  category: AgeCategory;
  age_from: number;
  age_to: number | null;
  counts_toward_capacity: boolean;
  max_count?: number | null;
  requires_crib?: boolean;
  crib_included?: boolean | null;
}

export interface RoomBeds {
  base_beds: number;
  base_bed_type?: BaseBedType | null;
  extra_beds_max?: number | null;
  extra_bed_type?: ExtraBedType | null;
  shares_bed_max_age?: number | null;
  extra_bed_max_age?: number | null;
}

// M2 §2.3g (10.9.2026) — raspored osoba po krevetima. Čuvaju se SAMO odstupanja od izvedene
// matrice; prazan niz znači „sve fizički moguće kombinacije su dozvoljene", nikad „nijedna".
//
// Vlasnikovo tvrdo ograničenje istog dana: kategorije osoba (`CHD1`, `CHD2`…) su svojstvo
// CENOVNIKA i menjaju se od ugovora do ugovora, pa se ovde ne pojavljuje nijedna — samo uloga na
// krevetu. Zato se matrica unosi jednom po sobi i ostaje tačna za svaki budući cenovnik.
export interface BedCombination {
  key: string;
  allowed?: boolean;
  shared_bed_children?: number;
  note?: string | null;
}

// Jedan red matrice kako ga vraća API (`/catalog/products/bed-combinations/izvedi`) — izvedeno
// stanje spojeno sa odstupanjem koje na njega pada.
export interface RedMatrice {
  key: string;
  odraslih: number;
  dece: number;
  ukupno: number;
  raspored: { krevet: 'OSNOVNI' | 'POMOCNI'; ko: 'ODRASLA' | 'DETE' }[];
  decaNaPomocnom: number;
  allowed: boolean;
  shared_bed_children: number;
  note: string | null;
  imaOdstupanje: boolean;
}

// `beds`, `capacity_*` i `name` su po M2 §2.3a/§2.3b deo svake stavke — ali `Product.attributes`
// je JSONB BEZ šeme (M2 §2, namerno "fleksibilan JSONB"), pa ništa ne sprečava da stigne stavka
// bez njih: uvoz sadržaja (§3.3), API provajder, starija seed skripta ili ručna izmena kroz
// PATCH. Tip koji ih proglašava obaveznim ne čini podatak takvim — samo sakrije da čitalac mora
// da izdrži izostanak (isti obrazac kao zamke 5.13 i 10.1: ugovor između dva sloja koji nijedan
// alat ne proverava). Zato su ovde opcioni, a prikaz/izmena imaju fallback.
export interface RoomType {
  code: string;
  name?: string;
  capacity_adults?: number;
  capacity_children?: number;
  min_occupancy?: number | null;
  size_sqm?: number | null;
  features?: string[];
  beds?: RoomBeds;
  age_policy?: AgePolicyEntry[];
  bed_combinations?: BedCombination[];
}

// Ono što se UREĐUJE u modalu je uvek potpuno — `openAdd`/`openEdit` popune svako polje pre nego
// što modal uopšte može da se otvori. Zato draft ima strože obaveze od zatečenog zapisa iznad:
// strogost stoji tamo gde je istinita, umesto da se `?.` provlači kroz ceo obrazac.
type RoomTypeDraft = RoomType & {
  name: string;
  capacity_adults: number;
  capacity_children: number;
  beds: RoomBeds;
};

const EMPTY_BEDS: RoomBeds = {
  base_beds: 0,
  base_bed_type: null,
  extra_beds_max: null,
  extra_bed_type: null,
  shares_bed_max_age: null,
  extra_bed_max_age: null,
};

// M2 §2.3b — "Podrazumevana politika (fallback)", isti niz kao backend `DEFAULT_AGE_POLICY`
// (apps/api/src/modules/m2-katalog-proizvoda/products/age-policy.ts) — nova soba u panelu kreće
// od ovoga, zaposleni menja samo ono što je kod tog hotela drugačije.
const DEFAULT_AGE_POLICY: AgePolicyEntry[] = [
  { category: 'ADULT', age_from: 12, age_to: null, counts_toward_capacity: true },
  { category: 'CHILD', age_from: 2, age_to: 11.99, counts_toward_capacity: true },
  {
    category: 'INFANT',
    age_from: 0,
    age_to: 1.99,
    counts_toward_capacity: false,
    requires_crib: true,
    crib_included: null,
  },
];

const BASE_BED_LABELS: Record<BaseBedType, string> = {
  FRANCUSKI_LEZAJ: 'Francuski ležaj',
  DVA_ODVOJENA_KREVETA: 'Dva odvojena kreveta',
  BRACNI_KREVET: 'Bračni krevet',
  DRUGO: 'Drugo',
};
const EXTRA_BED_LABELS: Record<ExtraBedType, string> = {
  RAZVODNI_KREVET: 'Razvodni krevet',
  SOFA_KREVET: 'Sofa-krevet',
  POMOCNI_LEZAJ: 'Pomoćni ležaj',
  DRUGO: 'Drugo',
};
const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = {
  ADULT: 'Odrasla osoba',
  CHILD: 'Dete',
  TEEN: 'Tinejdžer',
  INFANT: 'Beba',
};

// Šifra sobe kao broj — sadrži ID objekta (hotela) + rednu sobu unutar njega (28.8.2026, na
// zahtev vlasnika). `Product.id` je UUID, ne broj (nema sopstveno numeričko polje) — prvih 8 hex
// cifara (bez crtica) se pretvara u decimalan broj kao stabilan, jedinstven "brojčani" predstavnik
// hotela; svaka sledeća soba dobija redni broj IZNAD najvišeg do sada iskorišćenog za taj hotel
// (ne prost `length + 1`) — sprečava da izmena posle brisanja sobe slučajno dodeli šifru koju već
// nosi neka preostala soba.
function nextRoomCode(productId: string, existing: RoomType[]): string {
  const objectPart = String(parseInt(productId.replace(/-/g, '').slice(0, 8), 16));
  const usedSeqs = existing
    .map((rt) => rt.code)
    .filter((c) => c.startsWith(objectPart))
    .map((c) => Number(c.slice(objectPart.length)))
    .filter((n) => Number.isFinite(n));
  const nextSeq = (usedSeqs.length > 0 ? Math.max(...usedSeqs) : 0) + 1;
  return `${objectPart}${String(nextSeq).padStart(2, '0')}`;
}

function emptyRoomType(): RoomTypeDraft {
  return {
    code: '',
    name: '',
    capacity_adults: 2,
    capacity_children: 0,
    min_occupancy: null,
    size_sqm: null,
    features: [],
    beds: {
      base_beds: 1,
      base_bed_type: null,
      extra_beds_max: null,
      extra_bed_type: null,
      shares_bed_max_age: null,
      extra_bed_max_age: null,
    },
    age_policy: DEFAULT_AGE_POLICY.map((a) => ({ ...a })),
    bed_combinations: [],
  };
}

export default function RoomTypesEditor({
  productId,
  initialRoomTypes,
}: {
  productId: string;
  initialRoomTypes: RoomType[];
}) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(initialRoomTypes);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<RoomTypeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function openAdd() {
    setDraft(emptyRoomType());
    setEditingIndex(null);
    setError(null);
  }

  function openEdit(index: number) {
    const rt = roomTypes[index];
    // Zatečena stavka može biti bez `beds`/`capacity_*` (vidi napomenu uz RoomType) — modal ih
    // tada popunjava praznim vrednostima da zaposleni može da ih dopuni, umesto da ekran pukne.
    setDraft({
      ...rt,
      name: rt.name ?? '',
      capacity_adults: rt.capacity_adults ?? 0,
      capacity_children: rt.capacity_children ?? 0,
      beds: { ...EMPTY_BEDS, ...(rt.beds ?? {}) },
      age_policy: (rt.age_policy ?? DEFAULT_AGE_POLICY).map((a) => ({ ...a })),
      bed_combinations: (rt.bed_combinations ?? []).map((k) => ({ ...k })),
    });
    setEditingIndex(index);
    setError(null);
  }

  function closeModal() {
    setDraft(null);
    setEditingIndex(null);
  }

  function removeRoomType(index: number) {
    if (!confirm(`Ukloniti tip sobe "${roomTypes[index].name || roomTypes[index].code}"?`)) return;
    void persist(roomTypes.filter((_, i) => i !== index));
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError('Naziv je obavezan.');
      return;
    }
    // Šifra sobe (28.8.2026, na zahtev vlasnika: "šifra sobe treba da bude broj i da se
    // automatski kreira kada se klikne na sačuvaj... neka ima u sebi Id broj objekta + svoj Id")
    // — dodeljuje se SAMO pri prvom čuvanju nove sobe, isti obrazac kao svaki auto-generisan
    // identifikator u ovom kodu (ne menja se pri kasnijoj izmeni, M3 `ContractPeriod.room_type`
    // konvencija referencira ovaj kod, izmena posle unosa bi tiho pokidala tu vezu).
    const finalDraft =
      editingIndex === null ? { ...draft, code: nextRoomCode(productId, roomTypes) } : draft;
    const next = [...roomTypes];
    if (editingIndex === null) next.push(finalDraft);
    else next[editingIndex] = finalDraft;
    void persist(next);
  }

  async function persist(next: RoomType[]) {
    setSaving(true);
    setError(null);
    try {
      await saveRoomTypes(productId, next);
      setRoomTypes(next);
      setSavedAt(Date.now());
      closeModal();
    } catch {
      setError('Čuvanje nije uspelo. Pokušajte ponovo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Tipovi soba</h2>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[11px] text-success">sačuvano</span>}
          <Button onClick={openAdd} size="sm">
            + Dodaj sobu
          </Button>
        </div>
      </div>

      {roomTypes.length === 0 && (
        <p className="text-xs text-ink-faint">Nijedan tip sobe još nije unet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {roomTypes.map((rt, i) => (
          <div
            key={rt.code || i}
            className="flex items-center justify-between rounded-lg border border-border bg-panel2 px-3 py-2 text-xs"
          >
            <div>
              <span className="font-medium text-ink">{rt.name || 'Bez naziva'}</span>
              <span className="ml-2 font-mono text-ink-faint">{rt.code}</span>
              <div className="mt-0.5 text-ink-faint">
                {rt.beds
                  ? `${rt.beds.base_beds ?? 0} osnovni${rt.beds.base_bed_type ? ` (${BASE_BED_LABELS[rt.beds.base_bed_type]})` : ''}${
                      rt.beds.extra_beds_max
                        ? ` + do ${rt.beds.extra_beds_max} dodatna${rt.beds.extra_bed_type ? ` (${EXTRA_BED_LABELS[rt.beds.extra_bed_type]})` : ''}${
                            rt.beds.extra_bed_max_age != null
                              ? ` [dete do ${rt.beds.extra_bed_max_age}g]`
                              : ''
                          }`
                        : ''
                    }${rt.beds.shares_bed_max_age != null ? ` · deljenje kreveta do ${rt.beds.shares_bed_max_age}g` : ''}`
                  : 'kreveti nisu uneti'}
                {' · '}
                {rt.capacity_adults != null
                  ? `${rt.min_occupancy ? `${rt.min_occupancy}–` : ''}${rt.capacity_adults} odraslih${rt.capacity_children ? ` + ${rt.capacity_children} dece` : ''}`
                  : 'kapacitet nije unet'}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={() => openEdit(i)}
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-ink-faint hover:text-ink"
              >
                izmeni
              </Button>
              <Button
                onClick={() => removeRoomType(i)}
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-ink-faint hover:text-danger"
              >
                ukloni
              </Button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-panel p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {editingIndex === null ? 'Nova soba' : 'Izmena sobe'}
            </h3>
            {error && <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">{error}</p>}

            <div className="mb-4 grid grid-cols-2 gap-3">
              {editingIndex !== null && (
                <Field label="Šifra">
                  <span className="input flex items-center font-mono text-xs text-ink-faint">
                    {draft.code}
                  </span>
                </Field>
              )}
              <Field label="Naziv">
                <input
                  className="input text-xs"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="npr. Deluxe soba sa pogledom na more"
                />
              </Field>
              <Field label="Veličina (m²)">
                <input
                  type="number"
                  className="input text-xs"
                  value={draft.size_sqm ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      size_sqm: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Karakteristike (odvojene zarezom)">
                <input
                  className="input text-xs"
                  value={(draft.features ?? []).join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      features: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="balkon, pogled na more, kada"
                />
              </Field>
            </div>

            <h4 className="mb-2 text-xs font-semibold text-ink-faint">Kreveti</h4>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Field label="Broj osnovnih kreveta">
                <input
                  type="number"
                  min={0}
                  className="input text-xs"
                  value={draft.beds.base_beds}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      beds: { ...draft.beds, base_beds: Number(e.target.value) },
                    })
                  }
                />
              </Field>
              <Field label="Tip osnovnog kreveta">
                <ButtonGroup
                  value={draft.beds.base_bed_type ?? 'NIJE_UNET'}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      beds: { ...draft.beds, base_bed_type: v === 'NIJE_UNET' ? null : v },
                    })
                  }
                  options={[
                    { value: 'NIJE_UNET', label: 'nije unet' },
                    ...(Object.keys(BASE_BED_LABELS) as BaseBedType[]).map((v) => ({
                      value: v,
                      label: BASE_BED_LABELS[v],
                    })),
                  ]}
                />
              </Field>
              <Field label="Maks. broj dodatnih kreveta">
                <input
                  type="number"
                  min={0}
                  className="input text-xs"
                  value={draft.beds.extra_beds_max ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      beds: {
                        ...draft.beds,
                        extra_beds_max: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              {!!draft.beds.extra_beds_max && (
                <>
                  <Field label="Tip dodatnog kreveta">
                    <ButtonGroup
                      value={draft.beds.extra_bed_type ?? 'NIJE_UNET'}
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          beds: { ...draft.beds, extra_bed_type: v === 'NIJE_UNET' ? null : v },
                        })
                      }
                      options={[
                        { value: 'NIJE_UNET', label: 'nije unet' },
                        ...(Object.keys(EXTRA_BED_LABELS) as ExtraBedType[]).map((v) => ({
                          value: v,
                          label: EXTRA_BED_LABELS[v],
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Maks. uzrast deteta na pomoćnom krevetu">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input text-xs"
                      placeholder="npr. 7"
                      value={draft.beds.extra_bed_max_age ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          beds: {
                            ...draft.beds,
                            extra_bed_max_age:
                              e.target.value === '' ? null : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                </>
              )}
              <Field label="Maks. uzrast deteta koje deli krevet sa drugom osobom">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input text-xs"
                  placeholder="npr. 2 — bez sopstvenog ležajnog mesta"
                  value={draft.beds.shares_bed_max_age ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      beds: {
                        ...draft.beds,
                        shares_bed_max_age: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            </div>

            <h4 className="mb-2 text-xs font-semibold text-ink-faint">Kapacitet</h4>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Field label="Min. broj gostiju">
                <input
                  type="number"
                  min={0}
                  className="input text-xs"
                  value={draft.min_occupancy ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      min_occupancy: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Maks. odraslih">
                <input
                  type="number"
                  min={0}
                  className="input text-xs"
                  value={draft.capacity_adults}
                  onChange={(e) => setDraft({ ...draft, capacity_adults: Number(e.target.value) })}
                />
              </Field>
              <Field label="Maks. dece">
                <input
                  type="number"
                  min={0}
                  className="input text-xs"
                  value={draft.capacity_children}
                  onChange={(e) =>
                    setDraft({ ...draft, capacity_children: Number(e.target.value) })
                  }
                />
              </Field>
            </div>

            <BedCombinationsSection draft={draft} setDraft={setDraft} />

            <h4 className="mb-2 text-xs font-semibold text-ink-faint">Uzrasna politika</h4>
            <div className="mb-4 flex flex-col gap-2">
              {(draft.age_policy ?? []).map((ap, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto_auto] items-end gap-1.5 rounded border border-border p-2 text-[11px]"
                >
                  <Field label="Kategorija">
                    <ButtonGroup
                      value={ap.category}
                      onChange={(c) => updateAgePolicy(draft, setDraft, i, { category: c })}
                      options={(Object.keys(AGE_CATEGORY_LABELS) as AgeCategory[]).map((c) => ({
                        value: c,
                        label: AGE_CATEGORY_LABELS[c],
                      }))}
                    />
                  </Field>
                  <Field label="Od uzrasta">
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      value={ap.age_from}
                      onChange={(e) =>
                        updateAgePolicy(draft, setDraft, i, { age_from: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Do uzrasta">
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      value={ap.age_to ?? ''}
                      placeholder="i više"
                      onChange={(e) =>
                        updateAgePolicy(draft, setDraft, i, {
                          age_to: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <div className="pb-2">
                    <ToggleButton
                      active={ap.counts_toward_capacity}
                      onToggle={() =>
                        updateAgePolicy(draft, setDraft, i, {
                          counts_toward_capacity: !ap.counts_toward_capacity,
                        })
                      }
                      label="u kapacitet"
                    />
                  </div>
                  <div className="pb-2">
                    <ToggleButton
                      active={!!ap.requires_crib}
                      onToggle={() =>
                        updateAgePolicy(draft, setDraft, i, { requires_crib: !ap.requires_crib })
                      }
                      label="krevetac"
                    />
                  </div>
                  {ap.requires_crib && (
                    <div className="pb-2">
                      <ToggleButton
                        active={!!ap.crib_included}
                        onToggle={() =>
                          updateAgePolicy(draft, setDraft, i, { crib_included: !ap.crib_included })
                        }
                        label="uklj. u cenu"
                      />
                    </div>
                  )}
                  <Button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        age_policy: (draft.age_policy ?? []).filter((_, idx) => idx !== i),
                      })
                    }
                    variant="ghost"
                    size="sm"
                    className="mb-2 h-auto px-2 py-1 text-ink-faint hover:text-danger"
                  >
                    ukloni
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  setDraft({
                    ...draft,
                    age_policy: [
                      ...(draft.age_policy ?? []),
                      {
                        category: 'ADULT',
                        age_from: 0,
                        age_to: null,
                        counts_toward_capacity: true,
                      },
                    ],
                  })
                }
                variant="outline"
                size="sm"
                className="h-auto self-start px-2 py-1 text-[11px]"
              >
                + Dodaj uzrasnu kategoriju
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={closeModal} variant="ghost" size="sm">
                Otkaži
              </Button>
              <Button onClick={saveDraft} disabled={saving} size="sm">
                {saving ? 'Čuvanje…' : 'Sačuvaj sobu'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function updateAgePolicy(
  draft: RoomTypeDraft,
  setDraft: (r: RoomTypeDraft) => void,
  index: number,
  patch: Partial<AgePolicyEntry>,
) {
  const next = [...(draft.age_policy ?? [])];
  next[index] = { ...next[index], ...patch };
  setDraft({ ...draft, age_policy: next });
}

/**
 * M2 §2.3g — matrica kombinacija osoba po krevetima.
 *
 * Matricu RAČUNA API (`/api/catalog/bed-combinations` → `POST /catalog/products/bed-combinations/
 * izvedi`), ne ovaj ekran. Razlog nije lenjost nego to što isto izvođenje mora da važi i ovde i
 * pri prodaji (M5): dve kopije istog algoritma se tiho raziđu, pa bi ekran nudio raspored koji
 * prodaja odbija. Podrazumevana uzrasna politika JESTE prepisana u ovaj fajl, ali konstanta se
 * vidi golim okom — algoritam ne.
 *
 * Čuvaju se samo ODSTUPANJA: red koji ostane netaknut ne pravi nijedan zapis.
 */
function BedCombinationsSection({
  draft,
  setDraft,
}: {
  draft: RoomTypeDraft;
  setDraft: (d: RoomTypeDraft) => void;
}) {
  const [redovi, setRedovi] = useState<RedMatrice[] | null>(null);
  const [greska, setGreska] = useState<string | null>(null);

  const osnovnih = draft.beds.base_beds;
  const pomocnih = draft.beds.extra_beds_max ?? 0;
  const minGostiju = draft.min_occupancy ?? null;

  useEffect(() => {
    const kontrola = new AbortController();
    // Kratko odlaganje: broj kreveta se kuca cifru po cifru, a svaka cifra bi bila zaseban zahtev.
    const tajmer = setTimeout(async () => {
      try {
        const odg = await fetch('/api/catalog/bed-combinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beds: { base_beds: osnovnih, extra_beds_max: pomocnih },
            min_occupancy: minGostiju,
          }),
          signal: kontrola.signal,
        });
        if (!odg.ok) throw new Error('nije uspelo');
        setRedovi(((await odg.json()) as { redovi: RedMatrice[] }).redovi);
        setGreska(null);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        // Prazna tabela bi izgledala kao „soba ništa ne prima" — mora se reći da matrica NIJE
        // stigla, ne ćutati (zamka: prazan ekran je prazna baza, ne pokvaren kod).
        setRedovi(null);
        setGreska('Matrica trenutno nije dostupna — proverite vezu pa pokušajte ponovo.');
      }
    }, 300);
    return () => {
      clearTimeout(tajmer);
      kontrola.abort();
    };
  }, [osnovnih, pomocnih, minGostiju]);

  const odstupanja = draft.bed_combinations ?? [];

  function postavi(key: string, izmena: Partial<BedCombination>) {
    const zatecen = odstupanja.find((k) => k.key === key) ?? { key };
    const spojen: BedCombination = { ...zatecen, ...izmena };
    // Red koji se vratio na izvedeno stanje ne ostavlja zapis (§2.3g: „čuvaju se samo
    // odstupanja"). Inače bi svaka otvorena soba počela da nosi pun spisak, koji zastari sa
    // prvim promenjenim krevetom.
    const jePodrazumevan =
      (spojen.allowed ?? true) && !(spojen.shared_bed_children ?? 0) && !(spojen.note ?? '').trim();
    const ostali = odstupanja.filter((k) => k.key !== key);
    setDraft({ ...draft, bed_combinations: jePodrazumevan ? ostali : [...ostali, spojen] });
  }

  const kljuceviMatrice = new Set((redovi ?? []).map((r) => r.key));
  const vanMatrice = redovi === null ? [] : odstupanja.filter((k) => !kljuceviMatrice.has(k.key));

  return (
    <>
      <h4 className="mb-1 text-xs font-semibold text-ink-faint">Kombinacije osoba po krevetima</h4>
      <p className="mb-2 text-[10px] leading-relaxed text-ink-faint">
        Izračunato iz kreveta koje ste uneli — odrasli pune osnovne krevete pre pomoćnih. Skinite
        kvačicu sa kombinacije koju hotel ne dozvoljava; sve ostalo ostaje dozvoljeno. Ovde nema
        kategorija iz cenovnika (dete 1, dete 2…) — one se menjaju od ugovora do ugovora, a raspored
        po krevetima je svojstvo sobe i ostaje isti za svaki budući cenovnik.
      </p>

      {greska && <p className="mb-4 rounded bg-danger-bg p-2 text-[11px] text-danger">{greska}</p>}

      {!greska && osnovnih + pomocnih === 0 && (
        <p className="mb-4 rounded border border-border bg-sunken p-2 text-[11px] text-ink-faint">
          Unesite broj kreveta iznad da bi se kombinacije izračunale.
        </p>
      )}

      {redovi !== null && redovi.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-ink-faint">
                <th className="w-16 py-1 font-normal">Dozvoljeno</th>
                <th className="py-1 font-normal">Sastav</th>
                <th className="py-1 font-normal">Ko na kom krevetu</th>
                <th className="w-28 py-1 font-normal">Još dele krevet</th>
                <th className="py-1 font-normal">Napomena</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {redovi.map((r) => {
                const o = odstupanja.find((k) => k.key === r.key);
                const dozvoljeno = o?.allowed ?? true;
                return (
                  <tr key={r.key} className={dozvoljeno ? '' : 'opacity-50'}>
                    <td className="py-1.5 align-top">
                      <input
                        type="checkbox"
                        checked={dozvoljeno}
                        onChange={(e) => postavi(r.key, { allowed: e.target.checked })}
                        aria-label={`dozvoli ${r.key}`}
                      />
                    </td>
                    <td className="py-1.5 align-top text-ink">
                      {sastavRecima(r.odraslih, r.dece)}
                      {r.decaNaPomocnom > 0 && draft.beds.extra_bed_max_age != null && (
                        <span className="block text-[10px] text-ink-faint">
                          {r.decaNaPomocnom === 1 ? 'dete' : 'deca'} na pomoćnom krevetu — do{' '}
                          {draft.beds.extra_bed_max_age} god.
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {r.raspored.map((m, i) => (
                          <span
                            key={i}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              m.krevet === 'OSNOVNI' ? 'bg-sunken text-ink' : 'bg-warn-bg text-warn'
                            }`}
                          >
                            {m.ko === 'ODRASLA' ? 'odrasla' : 'dete'}
                            <span className="text-ink-faint">
                              {' '}
                              · {m.krevet === 'OSNOVNI' ? 'osnovni' : 'pomoćni'}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-1.5 align-top">
                      <input
                        type="number"
                        min={0}
                        className="input w-16 text-[11px]"
                        value={o?.shared_bed_children ?? 0}
                        disabled={!dozvoljeno}
                        onChange={(e) =>
                          postavi(r.key, { shared_bed_children: Number(e.target.value) })
                        }
                        aria-label={`deca koja dele krevet uz ${r.key}`}
                      />
                    </td>
                    <td className="py-1.5 align-top">
                      <input
                        type="text"
                        className="input w-full text-[11px]"
                        placeholder="zašto je pravilo takvo"
                        value={o?.note ?? ''}
                        disabled={!dozvoljeno}
                        onChange={(e) => postavi(r.key, { note: e.target.value })}
                        aria-label={`napomena uz ${r.key}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {draft.beds.shares_bed_max_age == null && (
            <p className="mt-1 text-[10px] text-ink-faint">
              „Još dele krevet“ znači decu bez sopstvenog ležajnog mesta. Da bi se primenilo,
              popunite „maks. uzrast deteta koje deli krevet“ u odeljku Kreveti.
            </p>
          )}
        </div>
      )}

      {/*
        §2.3g — zapis čiji se ključ posle izmene kreveta više ne izvodi iz matrice se PRIJAVLJUJE
        i ignoriše, ne briše tiho: pravilo koje je neko svesno uneo ponovo postaje tačno čim se
        kreveti vrate.
      */}
      {vanMatrice.length > 0 && (
        <div className="mb-4 rounded border border-warn/40 bg-warn-bg p-2">
          <p className="text-[11px] text-warn">
            Ova pravila više ne odgovaraju unetim krevetima i ne primenjuju se:{' '}
            {vanMatrice.map((k) => k.key).join(', ')}. Ostaju zapisana — vrate li se kreveti na
            stari broj, ponovo važe. Obrišite ih samo ako pravilo stvarno više ne postoji.
          </p>
          <button
            type="button"
            className="mt-1 text-[10px] text-ink-faint underline hover:text-danger"
            onClick={() =>
              setDraft({
                ...draft,
                bed_combinations: odstupanja.filter((k) => kljuceviMatrice.has(k.key)),
              })
            }
          >
            obriši pravila koja se ne primenjuju
          </button>
        </div>
      )}
    </>
  );
}

/** „2 odrasle + 1 dete" — bez ijedne kategorije iz cenovnika, samo uloga na krevetu (§2.3g). */
function sastavRecima(odraslih: number, dece: number): string {
  const o = odraslih === 1 ? '1 odrasla' : `${odraslih} odrasle`;
  if (dece === 0) return o;
  return `${o} + ${dece === 1 ? '1 dete' : `${dece} dece`}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
