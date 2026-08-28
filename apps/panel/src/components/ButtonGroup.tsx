'use client';

// Dizajn sistem §6f (28.8.2026, na zahtev vlasnika: "gde god je moguće izbegao bih padajuće
// menije, koristio bih formu tastera na koji se klikne") — zamena za `<select>` kad je skup
// opcija mali i poznat unapred. Jednostruk izbor: tačno jedno dugme aktivno, klik na drugo
// prebacuje izbor (klik na već aktivno ga NE deselektuje — jednostruk izbor uvek ima vrednost).
export function ButtonGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded border px-2 py-1 text-xs ${
            value === o.value ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-faint hover:border-accent hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Višestruk izbor / boolean prekidač — prvi klik uključuje, drugi klik na ISTO dugme isključuje
// (vlasnikovo "dva klika za ono što ne želim" kad je dugme već bilo uključeno).
export function ToggleButton({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`rounded border px-2 py-1 text-xs ${
        active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-faint hover:border-accent hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}
