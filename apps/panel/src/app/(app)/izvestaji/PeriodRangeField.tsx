'use client';

import { useState } from 'react';
import DateRangeField from '@/components/DateRangeField';
import FieldInline from './FieldInline';

// M13 spec §7 dopuna (5.9.2026, vlasnikov zahtev: "od do datum stavite u jedno polje kao kod
// pretrage"; dopunjeno isti dan, "nazive polja stavite unutar polja") — zamenjuje dva odvojena
// `DateField` ("od"/"do") jednim dugmetom sa dvomesečnim kalendarom, isti `DateRangeField.tsx`
// koji već koriste `SearchCriteriaForm.tsx`/`CalendarFilterBar.tsx` (bez broja noćenja/+3/+5/+7
// dana — `showNightsAndQuick={false}`, isti razlog kao "Dolazak od/do"/"Odlazak od/do" tamo: ovo
// su nezavisne granice, ne "početak + trajanje"). Izdvojeno u sopstven klijentski fajl (kao
// `DynamicTree.tsx`) jer `DateRangeField` je kontrolisana komponenta (React state) —
// `izvestaji/page.tsx` ostaje server komponenta, ovaj mali omotač drži lokalno stanje i
// prosleđuje ga dalje kroz skrivena `from`/`to` polja (`nameFrom`/`nameTo`) da ih ISTA prava GET
// forma i dalje ponese pri "primeni filter". Sopstveni `FieldInline` (ne spolja iz `page.tsx`) —
// isti princip kao `FilterLocationFields.tsx`, providno dugme bez sopstvene ivice/pozadine
// (`className` override ispod) da se uklopi u zajednički okvir.
export default function PeriodRangeField({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  return (
    <FieldInline label="period">
      <DateRangeField
        fromValue={from}
        toValue={to}
        onChange={(nextFrom, nextTo) => {
          setFrom(nextFrom);
          setTo(nextTo);
        }}
        showNightsAndQuick={false}
        nameFrom="from"
        nameTo="to"
        className="w-full min-w-0 bg-transparent text-xs text-ink"
      />
    </FieldInline>
  );
}
