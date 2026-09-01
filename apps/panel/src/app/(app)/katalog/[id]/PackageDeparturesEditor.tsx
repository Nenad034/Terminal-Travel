'use client';

import { useState } from 'react';
import { addPackageDeparture, cancelPackageDeparture } from '../actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// M5 spec §3.0d.6 (v1.94, vlasnikova korekcija 31.8.2026) — grupni paket MORA imati unapred
// definisan jedan ili više datuma polaska; to više nije nešto što se izračunava iz sastojaka.
// Ovaj ekran je jedino mesto gde se ti termini stvarno dodaju/otkazuju — bez njega backend
// mehanizam (M2 CRUD, M5 pretraga/cenovanje) nema kako da se stvarno koristi.
export interface PackageDeparture {
  id: string;
  departureDate: string;
  returnDate: string;
  status: 'ACTIVE' | 'CANCELLED';
}

export default function PackageDeparturesEditor({
  productId,
  initialDepartures,
  hasDurationDays,
}: {
  productId: string;
  initialDepartures: PackageDeparture[];
  hasDurationDays: boolean;
}) {
  const [departures, setDepartures] = useState<PackageDeparture[]>(initialDepartures);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addDeparture() {
    if (!newDate) return;
    setSaving(true);
    setError(null);
    try {
      const created = await addPackageDeparture(productId, newDate);
      setDepartures([...departures, created].sort((a, b) => (a.departureDate < b.departureDate ? -1 : 1)));
      setNewDate('');
    } catch {
      setError('Dodavanje termina nije uspelo. Proverite da li je trajanje paketa (broj dana) sačuvano.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelDeparture(id: string) {
    setSaving(true);
    setError(null);
    try {
      await cancelPackageDeparture(productId, id);
      setDepartures(departures.map((d) => (d.id === id ? { ...d, status: 'CANCELLED' } : d)));
    } catch {
      setError('Otkazivanje termina nije uspelo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-panel p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Termini polaska</h2>
      <p className="mb-3 text-xs text-ink-faint">
        Paket mora imati bar jedan datum polaska da bi ga gost/agent mogao pronaći i rezervisati — datum povratka se
        računa automatski (polazak + trajanje paketa).
      </p>
      {error && <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">{error}</p>}
      {!hasDurationDays && (
        <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">
          Prvo unesite i sačuvajte trajanje paketa (broj dana) iznad — bez njega se ne može izračunati datum povratka.
        </p>
      )}

      <div className="mb-4 flex flex-col gap-1.5">
        {departures.length === 0 && <p className="text-xs text-ink-faint">Još nema definisanih termina.</p>}
        {departures.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded border border-border bg-bg px-3 py-1.5">
            <div className="text-xs text-ink">
              {d.departureDate.slice(0, 10)} → {d.returnDate.slice(0, 10)}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={d.status === 'ACTIVE' ? 'ok' : 'secondary'} className={d.status === 'ACTIVE' ? '' : 'text-ink-faint'}>
                {d.status === 'ACTIVE' ? 'aktivan' : 'otkazan'}
              </Badge>
              {d.status === 'ACTIVE' && (
                <button type="button" onClick={() => cancelDeparture(d.id)} disabled={saving} className="text-[11px] text-danger hover:underline">
                  otkaži
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-ink-faint">Novi datum polaska</span>
          <input className="input text-xs" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </label>
        <Button onClick={addDeparture} disabled={saving || !newDate || !hasDurationDays} size="sm">
          {saving ? 'Dodavanje…' : 'Dodaj termin'}
        </Button>
      </div>
    </div>
  );
}
