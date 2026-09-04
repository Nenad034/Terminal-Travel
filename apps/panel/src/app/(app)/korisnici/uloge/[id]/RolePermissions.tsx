'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveRolePermissions } from '../../actions';
import { Button } from '@/components/ui/button';

export interface PermissionOption {
  id: string;
  module: string;
  resource: string;
  action: string;
  description: string;
}

// M1 spec §7 (dopuna 4.9.2026) — uređivanje dozvola uloge. Do ove dopune veza uloga↔dozvola
// postojala je isključivo u seed skripti, pa uloga napravljena kroz panel nije mogla ništa.
// Čekboksi su grupisani po modulu jer katalog ima preko 200 dozvola — bez grupisanja se ne
// može pročitati šta uloga zapravo sme.
export default function RolePermissions({
  roleId,
  allPermissions,
  assignedIds,
  canEdit,
}: {
  roleId: string;
  allPermissions: PermissionOption[];
  assignedIds: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState('');

  const original = useMemo(() => new Set(assignedIds), [assignedIds]);
  const added = [...selected].filter((id) => !original.has(id));
  const removed = [...original].filter((id) => !selected.has(id));
  const dirty = added.length > 0 || removed.length > 0;

  const byModule = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const groups = new Map<string, PermissionOption[]>();
    for (const p of allPermissions) {
      const label = `${p.module}/${p.resource}/${p.action} ${p.description}`.toLowerCase();
      if (q && !label.includes(q)) continue;
      const list = groups.get(p.module) ?? [];
      list.push(p);
      groups.set(p.module, list);
    }
    // Moduli se sortiraju brojčano (M2 pre M10), ne kao tekst.
    return [...groups.entries()].sort(
      (a, b) => Number(a[0].replace(/\D/g, '')) - Number(b[0].replace(/\D/g, '')),
    );
  }, [allPermissions, filter]);

  function toggle(id: string) {
    if (!canEdit) return;
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveRolePermissions(roleId, added, removed);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-ink-dim">
          izabrano <span className="font-mono text-ink">{selected.size}</span> od{' '}
          <span className="font-mono">{allPermissions.length}</span>
          {dirty && (
            <span className="ml-2 text-warn">
              nesačuvano: +{added.length} / −{removed.length}
            </span>
          )}
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filtriraj dozvole…"
          className="rounded border border-border bg-bg px-2 py-1 text-xs text-ink"
        />
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {saved && !dirty && <p className="rounded bg-ok-bg p-3 text-sm text-ok">Dozvole su sačuvane i važe odmah.</p>}

      <div className="flex flex-col gap-3">
        {byModule.map(([module, perms]) => {
          const chosen = perms.filter((p) => selected.has(p.id)).length;
          return (
            <div key={module} className="rounded border border-border bg-panel2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-xs text-ink">{module}</h3>
                <span className="text-[11px] text-ink-faint">
                  {chosen}/{perms.length}
                </span>
              </div>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {perms.map((p) => (
                  <label
                    key={p.id}
                    title={p.description}
                    className={`flex items-start gap-2 rounded px-2 py-1 text-xs ${
                      canEdit ? 'cursor-pointer hover:bg-sunken' : 'cursor-not-allowed opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      disabled={!canEdit}
                      className="mt-0.5"
                    />
                    <span className="font-mono text-ink-dim">
                      {p.resource}/{p.action}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {byModule.length === 0 && <p className="text-xs text-ink-faint">Nijedna dozvola ne odgovara filteru.</p>}
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={!dirty || pending}>
            {pending ? 'čuvam…' : './sacuvaj_dozvole'}
          </Button>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setSelected(new Set(assignedIds));
                setSaved(false);
              }}
              className="text-xs text-ink-faint hover:text-ink"
            >
              poništi izmene
            </button>
          )}
        </div>
      )}
    </div>
  );
}
