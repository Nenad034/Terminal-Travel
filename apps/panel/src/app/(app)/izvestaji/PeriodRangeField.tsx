'use client';

import { useState } from 'react';
import DateRangeField from '@/components/DateRangeField';

// M13 spec §7 dopuna (5.9.2026, vlasnikov zahtev: "od do datum stavite u jedno polje kao kod
// pretrage") — zamenjuje dva odvojena `DateField` ("od"/"do") jednim dugmetom sa dvomesečnim
// kalendarom, isti `DateRangeField.tsx` koji već koriste `SearchCriteriaForm.tsx`/
// `CalendarFilterBar.tsx` (bez broja noćenja/+3/+5/+7 dana — `showNightsAndQuick={false}`, isti
// razlog kao "Dolazak od/do"/"Odlazak od/do" tamo: ovo su nezavisne granice, ne "početak +
// trajanje"). Izdvojeno u sopstven klijentski fajl (kao `DynamicTree.tsx`) jer `DateRangeField`
// je kontrolisana komponenta (React state) — `izvestaji/page.tsx` ostaje server komponenta, ovaj
// mali omotač drži lokalno stanje i prosleđuje ga dalje kroz skrivena `from`/`to` polja
// (`nameFrom`/`nameTo`) da ih ISTA prava GET forma i dalje ponese pri "primeni filter".
export default function PeriodRangeField({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  return (
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
      className="input w-56"
    />
  );
}
