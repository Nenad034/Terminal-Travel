import Link from 'next/link';

// M17 spec §4/§7 (Faza 7) — pod-navigacija za tri poglede jednog članka (Pregled/Izvori/Revizije,
// isti princip kao M21 HelpTabs). Čisto navigaciona traka — svaka stranica gate-uje sopstvenu
// vidljivost akcija preko hasPermission (M23 spec §6), ova traka ne nosi proveru prava.
export default function ArticleTabs({ id, active }: { id: string; active: 'pregled' | 'izvori' | 'revizije' }) {
  const tabs: { id: 'pregled' | 'izvori' | 'revizije'; label: string; href: string }[] = [
    { id: 'pregled', label: 'pregled', href: `/znanje/${id}` },
    { id: 'izvori', label: 'izvori', href: `/znanje/${id}/izvori` },
    { id: 'revizije', label: 'revizije', href: `/znanje/${id}/revizije` },
  ];

  return (
    <div className="mb-4 flex gap-1 border-b border-border text-xs">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 font-medium ${
            active === t.id ? 'border-accent text-ink' : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
