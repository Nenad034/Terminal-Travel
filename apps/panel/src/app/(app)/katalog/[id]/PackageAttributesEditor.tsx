'use client';

import { useMemo, useState } from 'react';
import { savePackageAttributes } from '../actions';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

// M2 spec §2.3e (PACKAGE — `attributes.included_products[]`, `attributes.duration_days`),
// M5 spec §3.0d.6a (grupni paket: termin = presek FIXED/CHARTER perioda sastojaka, povratak =
// termin + duration_days, sastojci mogu biti CONTRACTED ili API bez razlike po Product.type).
// Standing pravilo (31.8.2026, feedback_code_plus_form_together): logika bez forme se ne računa
// kao završeno — ovaj ekran zatvara taj gap za PACKAGE proizvode (do sada je postojao samo za
// ACCOMMODATION preko RoomTypesEditor/HotelAttributesEditor).
export interface PackageAttributes {
  duration_days?: number | null;
  included_products?: string[];
}

export interface PickableProduct {
  id: string;
  type: string;
  name: string;
  destinationCity: string;
  destinationCountry: string;
}

export default function PackageAttributesEditor({
  productId,
  initial,
  candidates,
}: {
  productId: string;
  initial: PackageAttributes;
  candidates: PickableProduct[];
}) {
  const [durationDays, setDurationDays] = useState<string>(initial.duration_days != null ? String(initial.duration_days) : '');
  const [includedIds, setIncludedIds] = useState<string[]>(initial.included_products ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const selected = includedIds.map((id) => byId.get(id)).filter((p): p is PickableProduct => !!p);

  // Filtriranje po tekstu radi `cmdk` sam (`CommandItem.value`) — ovde ostaje samo pravilo
  // koje nije pretraga: već dodat proizvod se ne nudi ponovo.
  const available = candidates.filter((p) => !includedIds.includes(p.id));

  function addProduct(id: string) {
    setIncludedIds([...includedIds, id]);
  }
  function removeProduct(id: string) {
    setIncludedIds(includedIds.filter((x) => x !== id));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const days = Number(durationDays);
      if (!durationDays.trim() || !Number.isFinite(days) || days <= 0) {
        setError('Trajanje paketa (broj dana) mora biti pozitivan broj.');
        setSaving(false);
        return;
      }
      if (includedIds.length === 0) {
        setError('Paket mora sadržati bar jedan proizvod.');
        setSaving(false);
        return;
      }
      await savePackageAttributes(productId, { duration_days: days, included_products: includedIds });
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
        <h2 className="text-sm font-semibold text-ink">Sastav grupnog paketa</h2>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[11px] text-success">sačuvano</span>}
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? 'Čuvanje…' : 'Sačuvaj'}
          </Button>
        </div>
      </div>
      {error && <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">{error}</p>}

      <label className="mb-4 flex max-w-xs flex-col gap-0.5">
        <span className="text-[11px] text-ink-faint">Trajanje paketa (broj dana, uključujući dan polaska)</span>
        <input
          className="input text-xs"
          type="number"
          min={1}
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          placeholder="npr. 7"
        />
      </label>

      <h3 className="mb-2 text-xs font-semibold text-ink-faint">Uključeni proizvodi ({selected.length})</h3>
      {selected.length === 0 && <p className="mb-3 text-xs text-ink-faint">Još ništa nije dodato.</p>}
      <div className="mb-4 flex flex-col gap-1.5">
        {selected.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded border border-border bg-bg px-3 py-1.5">
            <div className="text-xs text-ink">
              {p.name} <span className="text-ink-faint">— {p.type} · {p.destinationCity}, {p.destinationCountry}</span>
            </div>
            <button type="button" onClick={() => removeProduct(p.id)} className="text-[11px] text-danger hover:underline">
              ukloni
            </button>
          </div>
        ))}
      </div>

      {/* Birač proizvoda — shadcn Command u Popover-u (2.9.2026). Do tada je ovde stajala ručno
          pisana lista sa sopstvenim `<input>` i `.filter()`-om, zato što `npm install` na ovoj
          mašini nije radio pa `cmdk` nije mogao da se instalira. Razlika nije samo izgled:
          `cmdk` daje kretanje strelicama i Enter za potvrdu, što ručna lista nije imala —
          unos deset sastojaka paketa je pre toga tražio deset odlazaka na miš. */}
      <h3 className="mb-2 text-xs font-semibold text-ink-faint">Dodaj proizvod</h3>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full justify-between">
            <span className="text-ink-dim">
              {available.length > 0 ? 'Izaberi proizvod…' : 'Nema više proizvoda za dodavanje'}
            </span>
            <Icon name="chevron-down" className="text-ink-faint" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] max-w-[90vw] p-0">
          <Command>
            <CommandInput placeholder="pretraga po nazivu ili destinaciji…" />
            <CommandList>
              <CommandEmpty>Nema rezultata.</CommandEmpty>
              {available.map((p) => (
                <CommandItem
                  key={p.id}
                  // `value` je ono nad čim cmdk pretražuje — naziv, destinacija i tip, isti
                  // skup polja koji je ranije ručni filter obuhvatao.
                  value={`${p.name} ${p.destinationCity} ${p.destinationCountry} ${p.type}`}
                  onSelect={() => {
                    addProduct(p.id);
                    // Popover ostaje otvoren: sastojci paketa se dodaju u nizu, pa zatvaranje
                    // posle svakog izbora znači ponovno otvaranje za svaki sledeći.
                  }}
                >
                  <span className="truncate">
                    {p.name} <span className="text-ink-faint">— {p.type} · {p.destinationCity}, {p.destinationCountry}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
