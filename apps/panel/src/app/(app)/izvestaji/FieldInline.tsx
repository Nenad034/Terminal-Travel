// M13 spec §7 dopuna (5.9.2026, vlasnikov zahtev uz snimak ekrana: "razlikuju se polja...
// nazive polja stavite unutar polja ne iznad ili ispod... nema razloga da 'odnosi se na' i
// 'segment' budu drugaciji vizuelno od ostalih polja... ravnomerno rasporedite sirinu svih
// drugih polja prema velicini ekrana"). JEDAN vizuelni oblik za SVAKO polje filter reda —
// naziv polja kao sitan, uvek vidljiv tekst UNUTAR iste ivice/pozadine kao sam unos (ne
// `<label>` iznad/ispod, obrazac koji je ekran do sad koristio preko `Field` helper-a). Bez
// `'use client'` — čisto prezentacioni omotač, koristi ga i server komponenta (`page.tsx`) i
// klijentske (`FilterSuggestField.tsx`/`PeriodRangeField.tsx`) direktno.
export default function FieldInline({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-9 min-w-[140px] flex-1 items-center gap-1.5 rounded border border-border bg-panel px-2 text-xs">
      <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </div>
  );
}
