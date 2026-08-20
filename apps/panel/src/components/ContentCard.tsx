import Link from 'next/link';
import Icon from './Icon';

// Dizajn dok. §6e — kartica-sa-akcijama, dve podforme. Deljena komponenta, ne obrazac koji
// se prepisuje po ekranima (§6a.2 tačka 5). Interni href (počinje sa "/") ide kroz next/link,
// spoljni href se otvara u novom tabu — isto pravilo kao svaka druga namerna radnja (§5a).
type BadgeTone = 'accent' | 'neutral' | 'ok' | 'warn' | 'danger';

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  accent: 'bg-accent-soft text-accent-strong',
  neutral: 'bg-panel-2 text-ink-faint',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
};

function CardLink({ href, children, className }: { href: string; children: React.ReactNode; className: string }) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

interface ActionLink {
  label: string;
  href: string;
}

interface ListLink {
  label: string;
  href: string;
  icon: string;
}

interface ContentCardProps {
  title: string;
  badge?: { label: string; tone?: BadgeTone };
  description?: string;
  actions?: ActionLink[];
  links?: ListLink[];
}

// Podforma "naslovni red akcija" — actions dobija strelicu posle teksta.
// Podforma "lista veza" — links dobija ikonicu ispred i razdelnu liniju između redova.
export default function ContentCard({ title, badge, description, actions, links }: ContentCardProps) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-medium text-ink">{title}</h3>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE_TONE_CLASSES[badge.tone ?? 'neutral']}`}>
            {badge.label}
          </span>
        )}
      </div>
      {description && <p className="text-xs text-ink-dim">{description}</p>}

      {actions && actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {actions.map((a) => (
            <CardLink key={a.href} href={a.href} className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong">
              {a.label} <Icon name="arrow-right" />
            </CardLink>
          ))}
        </div>
      )}

      {links && links.length > 0 && (
        <div className="mt-3 flex flex-col">
          {links.map((l, i) => (
            <CardLink
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 py-2 text-xs text-accent hover:text-accent-strong ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <Icon name={l.icon} className="text-ink-faint" />
              {l.label}
            </CardLink>
          ))}
        </div>
      )}
    </div>
  );
}
