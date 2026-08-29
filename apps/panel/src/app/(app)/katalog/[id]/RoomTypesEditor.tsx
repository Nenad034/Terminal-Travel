'use client';

import { useState } from 'react';
import { saveRoomTypes } from '../actions';
import { ButtonGroup, ToggleButton } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';

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
    if (!draft.name.trim()) {
      setError('Naziv je obavezan.');
      return;
    }
    // Šifra sobe (28.8.2026, na zahtev vlasnika: "šifra sobe treba da bude broj i da se
    // automatski kreira kada se klikne na sačuvaj... neka ima u sebi Id broj objekta + svoj Id")
    // — dodeljuje se SAMO pri prvom čuvanju nove sobe, isti obrazac kao svaki auto-generisan
    // identifikator u ovom kodu (ne menja se pri kasnijoj izmeni, M3 `ContractPeriod.room_type`
    // konvencija referencira ovaj kod, izmena posle unosa bi tiho pokidala tu vezu).
    const finalDraft = editingIndex === null ? { ...draft, code: nextRoomCode(productId, roomTypes) } : draft;
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
              <Button onClick={() => openEdit(i)} variant="ghost" size="sm" className="h-auto px-2 py-1 text-ink-faint hover:text-ink">
                izmeni
              </Button>
              <Button onClick={() => removeRoomType(i)} variant="ghost" size="sm" className="h-auto px-2 py-1 text-ink-faint hover:text-danger">
                ukloni
              </Button>
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
              {editingIndex !== null && (
                <Field label="Šifra">
                  <span className="input flex items-center font-mono text-xs text-ink-faint">{draft.code}</span>
                </Field>
              )}
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
                <ButtonGroup
                  value={draft.beds.base_bed_type ?? 'NIJE_UNET'}
                  onChange={(v) => setDraft({ ...draft, beds: { ...draft.beds, base_bed_type: v === 'NIJE_UNET' ? null : v } })}
                  options={[{ value: 'NIJE_UNET', label: 'nije unet' }, ...(Object.keys(BASE_BED_LABELS) as BaseBedType[]).map((v) => ({ value: v, label: BASE_BED_LABELS[v] }))]}
                />
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
                    <ButtonGroup
                      value={draft.beds.extra_bed_type ?? 'NIJE_UNET'}
                      onChange={(v) => setDraft({ ...draft, beds: { ...draft.beds, extra_bed_type: v === 'NIJE_UNET' ? null : v } })}
                      options={[{ value: 'NIJE_UNET', label: 'nije unet' }, ...(Object.keys(EXTRA_BED_LABELS) as ExtraBedType[]).map((v) => ({ value: v, label: EXTRA_BED_LABELS[v] }))]}
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
                    <ButtonGroup
                      value={ap.category}
                      onChange={(c) => updateAgePolicy(draft, setDraft, i, { category: c })}
                      options={(Object.keys(AGE_CATEGORY_LABELS) as AgeCategory[]).map((c) => ({ value: c, label: AGE_CATEGORY_LABELS[c] }))}
                    />
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
                  <div className="pb-2">
                    <ToggleButton
                      active={ap.counts_toward_capacity}
                      onToggle={() => updateAgePolicy(draft, setDraft, i, { counts_toward_capacity: !ap.counts_toward_capacity })}
                      label="u kapacitet"
                    />
                  </div>
                  <div className="pb-2">
                    <ToggleButton active={!!ap.requires_crib} onToggle={() => updateAgePolicy(draft, setDraft, i, { requires_crib: !ap.requires_crib })} label="krevetac" />
                  </div>
                  {ap.requires_crib && (
                    <div className="pb-2">
                      <ToggleButton active={!!ap.crib_included} onToggle={() => updateAgePolicy(draft, setDraft, i, { crib_included: !ap.crib_included })} label="uklj. u cenu" />
                    </div>
                  )}
                  <Button
                    onClick={() => setDraft({ ...draft, age_policy: (draft.age_policy ?? []).filter((_, idx) => idx !== i) })}
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
                  setDraft({ ...draft, age_policy: [...(draft.age_policy ?? []), { category: 'ADULT', age_from: 0, age_to: null, counts_toward_capacity: true }] })
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
