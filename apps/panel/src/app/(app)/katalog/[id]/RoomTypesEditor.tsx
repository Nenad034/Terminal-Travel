'use client';

import { useState } from 'react';
import { saveRoomTypes } from '../actions';

// M2 spec §2.3a/§2.3b/v1.14 (28.8.2026, na zahtev vlasnika: "koja polja sve taj panel treba da
// ima" — nakon nalaza da room_types[]/beds/age_policy[] postoje u modelu od v1.4, ali nemaju
// nijedan panel ekran za unos, samo API). Prvi primer u ovoj kodbazi obrasca "lista objekata +
// modal za dodavanje/izmenu" — nema ranijeg da se prati.
//
// NAMERNO VAN OBIMA: uređivanje hotelskih (ne-sobnih) attributes polja (stars/board_type/
// amenities/accommodation_type/contact) — ostaje samo API, zaseban zadatak (backlog, M2 sekcija).
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

export interface RoomType {
  code: string;
  name: string;
  capacity_adults: number;
  capacity_children: number;
  min_occupancy?: number | null;
  size_sqm?: number | null;
  features?: string[];
  beds: {
    base_beds: number;
    base_bed_type?: BaseBedType | null;
    extra_beds_max?: number | null;
    extra_bed_type?: ExtraBedType | null;
    shares_bed_max_age?: number | null;
    extra_bed_max_age?: number | null;
  };
  age_policy?: AgePolicyEntry[];
}

// M2 §2.3b — "Podrazumevana politika (fallback)", isti niz kao backend `DEFAULT_AGE_POLICY`
// (apps/api/src/modules/m2-katalog-proizvoda/products/age-policy.ts) — nova soba u panelu kreće
// od ovoga, zaposleni menja samo ono što je kod tog hotela drugačije.
const DEFAULT_AGE_POLICY: AgePolicyEntry[] = [
  { category: 'ADULT', age_from: 12, age_to: null, counts_toward_capacity: true },
  { category: 'CHILD', age_from: 2, age_to: 11.99, counts_toward_capacity: true },
  { category: 'INFANT', age_from: 0, age_to: 1.99, counts_toward_capacity: false, requires_crib: true, crib_included: null },
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
const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = { ADULT: 'Odrasla osoba', CHILD: 'Dete', TEEN: 'Tinejdžer', INFANT: 'Beba' };

function emptyRoomType(): RoomType {
  return {
    code: '',
    name: '',
    capacity_adults: 2,
    capacity_children: 0,
    min_occupancy: null,
    size_sqm: null,
    features: [],
    beds: { base_beds: 1, base_bed_type: null, extra_beds_max: null, extra_bed_type: null, shares_bed_max_age: null, extra_bed_max_age: null },
    age_policy: DEFAULT_AGE_POLICY.map((a) => ({ ...a })),
  };
}

export default function RoomTypesEditor({ productId, initialRoomTypes }: { productId: string; initialRoomTypes: RoomType[] }) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(initialRoomTypes);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<RoomType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function openAdd() {
    setDraft(emptyRoomType());
    setEditingIndex(null);
    setError(null);
  }

  function openEdit(index: number) {
    setDraft({ ...roomTypes[index], beds: { ...roomTypes[index].beds }, age_policy: (roomTypes[index].age_policy ?? DEFAULT_AGE_POLICY).map((a) => ({ ...a })) });
    setEditingIndex(index);
    setError(null);
  }

  function closeModal() {
    setDraft(null);
    setEditingIndex(null);
  }

  function removeRoomType(index: number) {
    if (!confirm(`Ukloniti tip sobe "${roomTypes[index].name}"?`)) return;
    void persist(roomTypes.filter((_, i) => i !== index));
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.code.trim() || !draft.name.trim()) {
      setError('Šifra i naziv su obavezni.');
      return;
    }
    const next = [...roomTypes];
    if (editingIndex === null) next.push(draft);
    else next[editingIndex] = draft;
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
          <button onClick={openAdd} className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
            + Dodaj sobu
          </button>
        </div>
      </div>

      {roomTypes.length === 0 && <p className="text-xs text-ink-faint">Nijedan tip sobe još nije unet.</p>}

      <div className="flex flex-col gap-1.5">
        {roomTypes.map((rt, i) => (
          <div key={rt.code || i} className="flex items-center justify-between rounded-lg border border-border bg-panel2 px-3 py-2 text-xs">
            <div>
              <span className="font-medium text-ink">{rt.name}</span>
              <span className="ml-2 font-mono text-ink-faint">{rt.code}</span>
              <div className="mt-0.5 text-ink-faint">
                {rt.beds.base_beds} osnovni{rt.beds.base_bed_type ? ` (${BASE_BED_LABELS[rt.beds.base_bed_type]})` : ''}
                {rt.beds.extra_beds_max
                  ? ` + do ${rt.beds.extra_beds_max} dodatna${rt.beds.extra_bed_type ? ` (${EXTRA_BED_LABELS[rt.beds.extra_bed_type]})` : ''}${
                      rt.beds.extra_bed_max_age != null ? ` [dete do ${rt.beds.extra_bed_max_age}g]` : ''
                    }`
                  : ''}
                {rt.beds.shares_bed_max_age != null ? ` · deljenje kreveta do ${rt.beds.shares_bed_max_age}g` : ''}
                {' · '}
                {rt.min_occupancy ? `${rt.min_occupancy}–` : ''}
                {rt.capacity_adults} odraslih{rt.capacity_children ? ` + ${rt.capacity_children} dece` : ''}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(i)} className="rounded px-2 py-1 text-ink-faint hover:bg-panel hover:text-ink">
                izmeni
              </button>
              <button onClick={() => removeRoomType(i)} className="rounded px-2 py-1 text-ink-faint hover:bg-panel hover:text-danger">
                ukloni
              </button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-ink">{editingIndex === null ? 'Nova soba' : 'Izmena sobe'}</h3>
            {error && <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">{error}</p>}

            <div className="mb-4 grid grid-cols-2 gap-3">
              <Field label="Šifra">
                <input className="input text-xs" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="npr. DELUXE_SEA_VIEW" />
              </Field>
              <Field label="Naziv">
                <input className="input text-xs" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="npr. Deluxe soba sa pogledom na more" />
              </Field>
              <Field label="Veličina (m²)">
                <input
                  type="number"
                  className="input text-xs"
                  value={draft.size_sqm ?? ''}
                  onChange={(e) => setDraft({ ...draft, size_sqm: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Field>
              <Field label="Karakteristike (odvojene zarezom)">
                <input
                  className="input text-xs"
                  value={(draft.features ?? []).join(', ')}
                  onChange={(e) => setDraft({ ...draft, features: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
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
                  onChange={(e) => setDraft({ ...draft, beds: { ...draft.beds, base_beds: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Tip osnovnog kreveta">
                <select
                  className="input text-xs"
                  value={draft.beds.base_bed_type ?? ''}
                  onChange={(e) => setDraft({ ...draft, beds: { ...draft.beds, base_bed_type: (e.target.value || null) as BaseBedType | null } })}
                >
                  <option value="">nije unet</option>
                  {(Object.keys(BASE_BED_LABELS) as BaseBedType[]).map((v) => (
                    <option key={v} value={v}>
                      {BASE_BED_LABELS[v]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Maks. broj dodatnih kreveta">
                <input
                  type="number"
                  min={0}
                  className="input text-xs"
                  value={draft.beds.extra_beds_max ?? ''}
                  onChange={(e) => setDraft({ ...draft, beds: { ...draft.beds, extra_beds_max: e.target.value === '' ? null : Number(e.target.value) } })}
                />
              </Field>
              {!!draft.beds.extra_beds_max && (
                <>
                  <Field label="Tip dodatnog kreveta">
                    <select
                      className="input text-xs"
                      value={draft.beds.extra_bed_type ?? ''}
                      onChange={(e) => setDraft({ ...draft, beds: { ...draft.beds, extra_bed_type: (e.target.value || null) as ExtraBedType | null } })}
                    >
                      <option value="">nije unet</option>
                      {(Object.keys(EXTRA_BED_LABELS) as ExtraBedType[]).map((v) => (
                        <option key={v} value={v}>
                          {EXTRA_BED_LABELS[v]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Maks. uzrast deteta na pomoćnom krevetu">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input text-xs"
                      placeholder="npr. 7"
                      value={draft.beds.extra_bed_max_age ?? ''}
                      onChange={(e) => setDraft({ ...draft, beds: { ...draft.beds, extra_bed_max_age: e.target.value === '' ? null : Number(e.target.value) } })}
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
                  onChange={(e) => setDraft({ ...draft, beds: { ...draft.beds, shares_bed_max_age: e.target.value === '' ? null : Number(e.target.value) } })}
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
                  onChange={(e) => setDraft({ ...draft, min_occupancy: e.target.value === '' ? null : Number(e.target.value) })}
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
                  onChange={(e) => setDraft({ ...draft, capacity_children: Number(e.target.value) })}
                />
              </Field>
            </div>

            <h4 className="mb-2 text-xs font-semibold text-ink-faint">Uzrasna politika</h4>
            <div className="mb-4 flex flex-col gap-2">
              {(draft.age_policy ?? []).map((ap, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto_auto] items-end gap-1.5 rounded border border-border p-2 text-[11px]">
                  <Field label="Kategorija">
                    <select
                      className="input text-xs"
                      value={ap.category}
                      onChange={(e) => updateAgePolicy(draft, setDraft, i, { category: e.target.value as AgeCategory })}
                    >
                      {(Object.keys(AGE_CATEGORY_LABELS) as AgeCategory[]).map((c) => (
                        <option key={c} value={c}>
                          {AGE_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Od uzrasta">
                    <input type="number" step="0.01" className="input text-xs" value={ap.age_from} onChange={(e) => updateAgePolicy(draft, setDraft, i, { age_from: Number(e.target.value) })} />
                  </Field>
                  <Field label="Do uzrasta">
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      value={ap.age_to ?? ''}
                      placeholder="i više"
                      onChange={(e) => updateAgePolicy(draft, setDraft, i, { age_to: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </Field>
                  <label className="flex items-center gap-1 pb-2 text-ink-faint">
                    <input type="checkbox" checked={ap.counts_toward_capacity} onChange={(e) => updateAgePolicy(draft, setDraft, i, { counts_toward_capacity: e.target.checked })} />
                    u kapacitet
                  </label>
                  <label className="flex items-center gap-1 pb-2 text-ink-faint">
                    <input type="checkbox" checked={!!ap.requires_crib} onChange={(e) => updateAgePolicy(draft, setDraft, i, { requires_crib: e.target.checked })} />
                    krevetac
                  </label>
                  {ap.requires_crib && (
                    <label className="flex items-center gap-1 pb-2 text-ink-faint">
                      <input type="checkbox" checked={!!ap.crib_included} onChange={(e) => updateAgePolicy(draft, setDraft, i, { crib_included: e.target.checked })} />
                      uklj. u cenu
                    </label>
                  )}
                  <button
                    onClick={() => setDraft({ ...draft, age_policy: (draft.age_policy ?? []).filter((_, idx) => idx !== i) })}
                    className="mb-2 rounded px-2 py-1 text-ink-faint hover:text-danger"
                  >
                    ukloni
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setDraft({ ...draft, age_policy: [...(draft.age_policy ?? []), { category: 'ADULT', age_from: 0, age_to: null, counts_toward_capacity: true }] })
                }
                className="self-start rounded border border-border px-2 py-1 text-[11px] text-ink-faint hover:border-accent hover:text-accent"
              >
                + Dodaj uzrasnu kategoriju
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="rounded px-3 py-1.5 text-xs text-ink-faint hover:text-ink">
                Otkaži
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
              >
                {saving ? 'Čuvanje…' : 'Sačuvaj sobu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function updateAgePolicy(draft: RoomType, setDraft: (r: RoomType) => void, index: number, patch: Partial<AgePolicyEntry>) {
  const next = [...(draft.age_policy ?? [])];
  next[index] = { ...next[index], ...patch };
  setDraft({ ...draft, age_policy: next });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
