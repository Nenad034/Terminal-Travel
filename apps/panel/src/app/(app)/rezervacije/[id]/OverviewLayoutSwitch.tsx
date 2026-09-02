'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
// Ključ i tip su u neutralnom modulu, ne ovde — ovaj fajl je `'use client'`, pa bi server
// komponenta koja uveze konstantu odavde dobila klijentsku referencu umesto stringa
// (obrazloženje i posledice: `overview-layout.ts`).
import { OVERVIEW_LAYOUT_PREFERENCE_KEY, type OverviewLayout } from './overview-layout';

// Prekidač između novog i zatečenog izgleda kartice "Pregled" (2.9.2026, na zahtev vlasnika:
// "hajde uradite samo za rezervacije da vidim kako uživo izgleda ali sačuvajte i ovaj sadašnji
// pregled ako mi se ne bude svidelo da ga vratimo").
//
// PRIVREMENO, NAMERNO — ne trajno rešenje. Dva paralelna izgleda istog ekrana su tačno ono što
// `docs/analize/22-ANALIZA-PRIMETRAVEL-NALAZI.md` opisuje kao način na koji je prethodni projekat
// dobio četiri dashboard-a koji rade isti posao. Ovde postoji SAMO dok vlasnik ne odluči; onda se
// izgled koji je izgubio briše iz koda, zajedno sa ovim prekidačem i preferencom. Zavedeno kao
// otvorena stavka u `27-BACKLOG-IDEJA-I-PREDLOZI.md` da se ne zaboravi.
//
// Zašto preferenca a ne URL parametar: vlasnik treba da klikne jednom i da mu izbor ostane dok
// ekran koristi kroz dan (i na drugom računaru) — poređenje "kako je bilo" ima smisla tek posle
// pola sata stvarnog rada, ne u trenutku prebacivanja. Isti mehanizam kao širina sadržaja
// (`main_content_max_width`, M1 §3.9).
export default function OverviewLayoutSwitch({ current }: { current: OverviewLayout }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const next: OverviewLayout = current === 'novi' ? 'klasicni' : 'novi';

  async function toggle() {
    setSaving(true);
    try {
      await fetch(`/api/preferences/${OVERVIEW_LAYOUT_PREFERENCE_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
    } catch {
      // Neuspeo upis ne sme da zaustavi prebacivanje — osvežavanje ispod i dalje prikazuje
      // izabran izgled za ovu sesiju, samo se ne pamti za sledeću prijavu.
    }
    setSaving(false);
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      disabled={saving || pending}
      title={
        current === 'novi'
          ? 'Vrati zatečeni izgled kartice Pregled (kartice jedna ispod druge)'
          : 'Prikaži novi izgled kartice Pregled (sažetak na vrhu, dve kolone)'
      }
      className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[11px] text-ink-faint hover:border-accent hover:text-accent disabled:opacity-50"
    >
      <Icon name="history" />
      {current === 'novi' ? 'Vrati stari izgled' : 'Novi izgled'}
    </button>
  );
}
