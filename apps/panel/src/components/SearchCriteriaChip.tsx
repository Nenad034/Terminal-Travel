'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from './Icon';
import SearchCriteriaPopup, { valuesFromSearchParams } from './SearchCriteriaPopup';
import { findIconByTypes } from '@/lib/search-product-types';

// Sažetak aktivne pretrage na vrhu centralnog panela (22.8.2026, na zahtev vlasnika: "kreira
// se link u kom se vidi šta se pretražuje i na kraju linka je dugme izmeni... klikom na izmeni
// ponovo se otvara popup"). Deli ISTI `SearchCriteriaPopup` sa ikonicama u levom panelu
// (SearchSidebarPanel.tsx) — samo drugi okidač (ovde: "izmeni" dugme, tamo: klik na ikonicu).
export default function SearchCriteriaChip() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);

  const types = sp.getAll('type');
  if (types.length === 0) return null; // nema aktivne pretrage — nema šta da se sažme

  const icon = findIconByTypes(types);
  const label = icon?.label ?? types.join(', ');
  const destination = [sp.get('destinationCity'), sp.get('destinationCountry')].filter(Boolean).join(', ');
  const dates = sp.get('stayFrom') && sp.get('stayTo') ? `${sp.get('stayFrom')} – ${sp.get('stayTo')}` : null;
  const occupancy = `${sp.get('adults') ?? '2'} odr.${Number(sp.get('children') ?? '0') > 0 ? ` + ${sp.get('children')} dece` : ''}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs text-ink">
        <Icon name={icon?.icon ?? 'search'} className="text-accent-strong" />
        <span className="font-semibold">{label}</span>
        {destination && <span className="text-ink-dim">· {destination}</span>}
        {dates && <span className="text-ink-dim">· {dates}</span>}
        <span className="text-ink-dim">· {occupancy}</span>
        <button onClick={() => setOpen(true)} className="ml-1 flex items-center gap-1 text-accent-strong hover:underline">
          <Icon name="edit" /> izmeni
        </button>
      </div>

      {open && (
        <SearchCriteriaPopup label={label} types={types} initialValues={valuesFromSearchParams(sp)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
