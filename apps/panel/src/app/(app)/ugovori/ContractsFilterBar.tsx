'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

// 8.9.2026, vlasnikov nalaz: "ovde ne mogu da isfiltriram ugovore kao na primer u katalogu".
// Lista ugovora je do sad bila samo hronološka — sa desetak e2e ostataka u bazi, traženje
// konkretnog ugovora je značilo skrolovanje.
//
// Filtriranje ide na SERVER (`GET /contracting/contracts?q=&status=&supplierId=`), ne nad
// dovučenom stranom: lista je straničena, pa bi klijentski filter pretraživao samo trenutnih
// N redova i tiho krio ostalo (isti razlog zbog kog je to ranije ispravljeno na drugim listama,
// dok. 27 nalaz 2.2).

const STATUS_OPCIJE = [
  { value: '', label: 'svi' },
  { value: 'ACTIVE', label: 'aktivni' },
  { value: 'DRAFT', label: 'nacrti' },
  { value: 'EXPIRED', label: 'istekli' },
  { value: 'TERMINATED', label: 'raskinuti' },
];

export default function ContractsFilterBar({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get('q') ?? '');

  function primeni(izmene: Record<string, string>) {
    const v = new URLSearchParams(params?.toString() ?? '');
    for (const [kljuc, vrednost] of Object.entries(izmene)) {
      if (vrednost) v.set(kljuc, vrednost);
      else v.delete(kljuc);
    }
    // Svaka promena filtera vraća na prvu stranu — inače se lako završi na praznoj strani 3.
    v.delete('page');
    router.push(`/ugovori?${v.toString()}`);
  }

  const status = params?.get('status') ?? '';
  const supplierId = params?.get('supplierId') ?? '';
  const imaFiltera = Boolean(q || status || supplierId);

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-panel p-3">
      <label className="flex flex-1 flex-col gap-1 text-[11px] uppercase tracking-wide text-ink-faint">
        Traži (broj ugovora ili dobavljač)
        <form
          onSubmit={(e) => {
            e.preventDefault();
            primeni({ q });
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => primeni({ q })}
            placeholder="npr. TT-MOCK-CAP ili Splendid"
            className="input w-full"
          />
        </form>
      </label>

      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-ink-faint">
        Status
        <select
          value={status}
          onChange={(e) => primeni({ status: e.target.value })}
          className="input"
        >
          {STATUS_OPCIJE.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-ink-faint">
        Dobavljač
        <select
          value={supplierId}
          onChange={(e) => primeni({ supplierId: e.target.value })}
          className="input max-w-[260px]"
        >
          <option value="">svi dobavljači</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {imaFiltera && (
        <button
          type="button"
          onClick={() => {
            setQ('');
            primeni({ q: '', status: '', supplierId: '' });
          }}
          className="rounded px-2 py-1.5 text-[11px] text-ink-dim hover:bg-sunken"
        >
          poništi filtere
        </button>
      )}
    </div>
  );
}
