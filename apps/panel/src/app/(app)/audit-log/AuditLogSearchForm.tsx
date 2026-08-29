'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DateField from '@/components/DateField';
import { Button } from '@/components/ui/button';

const DEBOUNCE_MS = 300;

interface Params {
  module?: string;
  action?: string;
  q?: string;
  from?: string;
  to?: string;
  back?: string;
  backLabel?: string;
}

function buildHref(params: Params): string {
  const qs = new URLSearchParams();
  if (params.module) qs.set('module', params.module);
  if (params.action) qs.set('action', params.action);
  if (params.q) qs.set('q', params.q);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.back) qs.set('back', params.back);
  if (params.backLabel) qs.set('backLabel', params.backLabel);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `/audit-log${suffix}`;
}

// Dopuna (29.8.2026, na zahtev vlasnika: "omogucite kada se ukucava pojama da se odmah
// filtrirajju stavke liste") — pretraga se ranije primenjivala tek na klik "pretraži" (puna
// navigacija). Pojam se sad debounce-uje (300ms posle poslednjeg tastera, isti princip kao
// svaka "search as you type" forma — sprečava navigaciju na svaki pojedinačni taster) i menja
// URL preko `router.replace` (ne `push` — pretraga ne puni istoriju nazad-dugmeta pojedinačnim
// slovima). Datum (DateField.tsx) se primenjuje odmah pri izboru — to je jedan diskretan čin
// (klik na dan/kompletiran unos), ne kontinuirano kucanje, pa debounce tu nije potreban.
export default function AuditLogSearchForm({ module, action, q, from, to, back, backLabel }: Params) {
  const router = useRouter();
  const [qDraft, setQDraft] = useState(q ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQDraft(q ?? '');
  }, [q]);

  function applyQ(nextQ: string) {
    setQDraft(nextQ);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(buildHref({ module, action, q: nextQ, from, to, back, backLabel }));
    }, DEBOUNCE_MS);
  }

  function applyDate(key: 'from' | 'to', isoValue: string) {
    router.replace(
      buildHref({
        module,
        action,
        q: qDraft,
        from: key === 'from' ? isoValue : from,
        to: key === 'to' ? isoValue : to,
        back,
        backLabel,
      }),
    );
  }

  const hasSearch = Boolean(q || from || to);

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-0.5">
        <span className="text-ink-faint">pojam</span>
        <input value={qDraft} onChange={(e) => applyQ(e.target.value)} placeholder="akcija, resurs, modul…" className="input" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-ink-faint">od datuma</span>
        <DateField value={from ?? ''} onChange={(iso) => applyDate('from', iso)} />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-ink-faint">do datuma</span>
        <DateField value={to ?? ''} onChange={(iso) => applyDate('to', iso)} />
      </label>
      {hasSearch && (
        <Button asChild variant="ghost" size="sm">
          <Link href={buildHref({ module, action, back, backLabel })}>obriši pretragu</Link>
        </Button>
      )}
    </div>
  );
}
