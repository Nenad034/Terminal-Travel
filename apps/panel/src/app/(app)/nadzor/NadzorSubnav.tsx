import Link from 'next/link';

const TABS: { href: string; label: string }[] = [
  { href: '/nadzor', label: 'signali' },
  { href: '/nadzor/kanali', label: 'kanali obaveštenja' },
  { href: '/nadzor/trendovi', label: 'trendovi' },
  { href: '/nadzor/ai-troskovi', label: 'AI troškovi' },
];

// M18 — mala navigacija između 4 podekrana ovog modula (signali/kanali/trendovi/AI troškovi),
// isti obrazac dugmadi kao /crm header linkovi ka /crm/ankete i /crm/gosti.
export default function NadzorSubnav({ active }: { active: string }) {
  return (
    <div className="mb-4 flex gap-1.5 text-xs">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded border px-3 py-1.5 font-medium ${
            t.href === active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-panel text-ink-dim hover:border-accent'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
