import Link from 'next/link';

// M17 spec §4/§7 (Faza 7) — jednostavna pod-navigacija između 4 M21 ekrana (isti princip kao
// marketing/kanali dugme u zaglavlju liste, ovde razvijeno u punu traku jer M21 ima 4 poglede
// umesto 2). Vidljivost svake kartice se svejedno gate-uje na svakoj stranici ponaosob preko
// hasPermission (§3) — ova traka je čisto navigaciona, ne nosi sopstvenu proveru prava.
export default function HelpTabs({
  active,
  showSuggestions,
  showQuestions,
}: {
  active: 'clanci' | 'predlozi' | 'pitanja';
  showSuggestions: boolean;
  showQuestions: boolean;
}) {
  const tabs: { id: 'clanci' | 'predlozi' | 'pitanja'; label: string; href: string; visible: boolean }[] = [
    { id: 'clanci', label: 'članci', href: '/pomoc', visible: true },
    { id: 'predlozi', label: 'predlozi', href: '/pomoc/predlozi', visible: showSuggestions },
    { id: 'pitanja', label: 'pitanja', href: '/pomoc/pitanja', visible: showQuestions },
  ];

  return (
    <div className="mb-4 flex gap-1 border-b border-border text-xs">
      {tabs
        .filter((t) => t.visible)
        .map((t) => (
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
