'use client';

import { useState } from 'react';
import { createDestinationProfile, updateDestinationProfile } from '../actions';
import { ButtonGroup, ToggleButton } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';

// M2 spec §2.1c (dopuna 5.9.2026, vlasnikov zahtev) — DestinationProfile tipizuje MESTO
// (destination_country + destination_city), ne pojedinačan proizvod: desetine hotela dele istu
// destinaciju. Koristi ga M5 §3.0c.3d (kontekstualni filteri po tipu destinacije/sezoni) i
// §3.0c.3e (pretraga po aktivnosti). Backend (commit 351b2fd) već postoji — ovaj ekran je
// jedini panel prikaz nad njim (do sada samo API, isto ograničenje kao dosta drugih M2 polja
// pre sopstvenog editora — vidi HotelAttributesEditor.tsx istorija).
//
// Isti obrazac kao RoomTypesEditor.tsx: lista + modal za dodavanje/izmenu. `destinationType`
// (jednostruk izbor) i `activities[]` (višestruk izbor) idu kao dugmad, ne padajući meni/
// checkbox lista (dizajn dok. §6f — mali, poznat skup opcija).
export type DestinationType = 'COASTAL' | 'MOUNTAIN' | 'URBAN' | 'SPA' | 'LAKE' | 'RURAL';
export type ActivityTag =
  | 'CYCLING' | 'HIKING' | 'HUNTING' | 'FISHING' | 'DIVING' | 'SKIING' | 'RAFTING' | 'WILDLIFE_WATCHING' | 'WINE_TASTING';

export interface DestinationProfile {
  id: string;
  destinationCountry: string;
  destinationCity: string;
  destinationType: DestinationType;
  activities: ActivityTag[];
}

export const DESTINATION_TYPE_LABELS: Record<DestinationType, string> = {
  COASTAL: 'Primorska',
  MOUNTAIN: 'Planinska',
  URBAN: 'Gradska',
  SPA: 'Banjska',
  LAKE: 'Jezerska',
  RURAL: 'Ruralna',
};

export const ACTIVITY_LABELS: Record<ActivityTag, string> = {
  CYCLING: 'Biciklizam',
  HIKING: 'Planinarenje',
  HUNTING: 'Lov',
  FISHING: 'Ribolov',
  DIVING: 'Ronjenje',
  SKIING: 'Skijanje',
  RAFTING: 'Rafting',
  WILDLIFE_WATCHING: 'Posmatranje divljih životinja',
  WINE_TASTING: 'Degustacija vina',
};

interface Draft {
  destinationCountry: string;
  destinationCity: string;
  destinationType: DestinationType;
  activities: ActivityTag[];
}

function emptyDraft(): Draft {
  return { destinationCountry: '', destinationCity: '', destinationType: 'COASTAL', activities: [] };
}

export default function DestinationProfilesEditor({ initial }: { initial: DestinationProfile[] }) {
  const [profiles, setProfiles] = useState<DestinationProfile[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setDraft(emptyDraft());
    setEditingId(null);
    setError(null);
  }

  function openEdit(p: DestinationProfile) {
    setDraft({ destinationCountry: p.destinationCountry, destinationCity: p.destinationCity, destinationType: p.destinationType, activities: [...p.activities] });
    setEditingId(p.id);
    setError(null);
  }

  function closeModal() {
    setDraft(null);
    setEditingId(null);
    setError(null);
  }

  function toggleActivity(tag: ActivityTag) {
    if (!draft) return;
    setDraft({ ...draft, activities: draft.activities.includes(tag) ? draft.activities.filter((a) => a !== tag) : [...draft.activities, tag] });
  }

  async function save() {
    if (!draft) return;
    if (editingId === null && (!draft.destinationCountry.trim() || !draft.destinationCity.trim())) {
      setError('Država i mesto su obavezni.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId === null) {
        const res = await createDestinationProfile({
          destinationCountry: draft.destinationCountry.trim(),
          destinationCity: draft.destinationCity.trim(),
          destinationType: draft.destinationType,
          activities: draft.activities,
        });
        if (res.error || !res.profile) {
          setError(res.error ?? 'Kreiranje nije uspelo.');
          return;
        }
        setProfiles((prev) => [...prev, res.profile!].sort((a, b) => a.destinationCountry.localeCompare(b.destinationCountry) || a.destinationCity.localeCompare(b.destinationCity)));
      } else {
        const res = await updateDestinationProfile(editingId, { destinationType: draft.destinationType, activities: draft.activities });
        if (res.error || !res.profile) {
          setError(res.error ?? 'Izmena nije uspela.');
          return;
        }
        setProfiles((prev) => prev.map((p) => (p.id === editingId ? res.profile! : p)));
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Profili destinacija</h2>
        <Button onClick={openAdd} size="sm">
          + Nova destinacija
        </Button>
      </div>
      <p className="mb-3 text-xs text-ink-faint">
        Tip destinacije i podržane aktivnosti se tagiraju JEDNOM po mestu (M2 spec §2.1c), ne po pojedinačnom proizvodu — koristi ih M5
        pretraga za kontekstualne filtere i pretragu po aktivnosti.
      </p>

      {profiles.length === 0 && <p className="text-xs text-ink-faint">Nijedna destinacija još nema profil.</p>}

      <div className="flex flex-col gap-1.5">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-panel2 px-3 py-2 text-xs">
            <div>
              <span className="font-medium text-ink">
                {p.destinationCity}, {p.destinationCountry}
              </span>
              <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-ink-dim">{DESTINATION_TYPE_LABELS[p.destinationType]}</span>
              {p.activities.length > 0 && (
                <div className="mt-0.5 text-ink-faint">{p.activities.map((a) => ACTIVITY_LABELS[a]).join(', ')}</div>
              )}
            </div>
            <Button onClick={() => openEdit(p)} variant="ghost" size="sm" className="h-auto px-2 py-1 text-ink-faint hover:text-ink">
              izmeni
            </Button>
          </div>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-ink">{editingId === null ? 'Nova destinacija' : 'Izmena profila destinacije'}</h3>
            {error && <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">{error}</p>}

            <div className="mb-4 grid grid-cols-2 gap-3">
              <Field label="Država">
                {editingId === null ? (
                  <input className="input text-xs" value={draft.destinationCountry} onChange={(e) => setDraft({ ...draft, destinationCountry: e.target.value })} placeholder="Grčka" />
                ) : (
                  <span className="input flex items-center text-xs text-ink-faint">{draft.destinationCountry}</span>
                )}
              </Field>
              <Field label="Mesto">
                {editingId === null ? (
                  <input className="input text-xs" value={draft.destinationCity} onChange={(e) => setDraft({ ...draft, destinationCity: e.target.value })} placeholder="Nikiti" />
                ) : (
                  <span className="input flex items-center text-xs text-ink-faint">{draft.destinationCity}</span>
                )}
              </Field>
            </div>
            {editingId !== null && (
              <p className="mb-3 text-[11px] text-ink-faint">
                Država/mesto se ne mogu menjati posle kreiranja (M2 spec §2.1c) — izmena para bi značila drugu destinaciju, ne izmenu ove.
              </p>
            )}

            <div className="mb-4">
              <span className="mb-1 block text-[11px] text-ink-faint">Tip destinacije</span>
              <ButtonGroup<DestinationType>
                value={draft.destinationType}
                onChange={(v) => setDraft({ ...draft, destinationType: v })}
                options={(Object.keys(DESTINATION_TYPE_LABELS) as DestinationType[]).map((v) => ({ value: v, label: DESTINATION_TYPE_LABELS[v] }))}
              />
            </div>

            <div className="mb-4">
              <span className="mb-1 block text-[11px] text-ink-faint">Aktivnosti koje destinacija podržava (opciono)</span>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(ACTIVITY_LABELS) as ActivityTag[]).map((tag) => (
                  <ToggleButton key={tag} active={draft.activities.includes(tag)} onToggle={() => toggleActivity(tag)} label={ACTIVITY_LABELS[tag]} />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={closeModal} variant="ghost" size="sm">
                Otkaži
              </Button>
              <Button onClick={save} disabled={saving} size="sm">
                {saving ? 'Čuvanje…' : 'Sačuvaj'}
              </Button>
            </div>
          </div>
        </div>
      )}
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
