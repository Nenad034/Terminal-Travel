import Link from 'next/link';
import Icon from './Icon';

// Straničenje na ekranu (5.9.2026, dok. 39 nalaz 2.2).
//
// ZAŠTO POSTOJI: do danas je lista rezervacija tiho odsecala na 200 redova — agencija sa 201
// rezervacijom ne bi videla najstariju, i ništa na ekranu ne bi reklo da nešto nedostaje.
// Serverski deo je pola posla; bez ove trake korisnik i dalje ne bi imao kako da vidi ostatak,
// što je „logika postoji, UI ne" iz CLAUDE.md.
//
// UVEK ISPISUJE UKUPAN BROJ, i kad ima samo jedna stranica — jer je jezgro nalaza bilo baš to
// da se ne zna koliko ih zapravo ima. Zato ovo NIJE samo par strelica.
//
// Obična `<Link>` navigacija (ne dugme sa `router.push`): stranica je server komponenta i čita
// `?strana=` iz adrese, pa je link i deljiv i radi sa „nazad" u browseru.
export default function Pagination({
  page,
  pageCount,
  total,
  shown,
  limit,
  basePath,
  searchParams,
  paramName = 'page',
  itemLabel = 'zapisa',
}: {
  page: number;
  pageCount: number;
  total: number;
  /** Koliko redova je stvarno prikazano na ovoj stranici (poslednja ume biti nepuna). */
  shown: number;
  /** Veličina stranice — raspon se MORA računati iz nje, ne iz `shown` (v. komentar niže). */
  limit: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  paramName?: string;
  itemLabel?: string;
}) {
  const hrefFor = (target: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (key === paramName) continue;
      if (Array.isArray(value)) for (const v of value) { if (v) qs.append(key, v); }
      else if (value) qs.set(key, value);
    }
    if (target > 1) qs.set(paramName, String(target));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  // ISPRAVKA pri proveri (5.9.2026): prvo je ovde stajalo `(page - 1) * shown`, što je na
  // POSLEDNJOJ, nepunoj stranici davalo pogrešan raspon — sa 25 redova i stranicom od 10, treća
  // strana je pisala „11–15" umesto „21–25", jer je `shown` tamo 5, a ne 10. Raspon se računa iz
  // veličine stranice; `shown` određuje samo gornju granicu.
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = total === 0 ? 0 : from + shown - 1;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
      <span>
        {total === 0 ? `nema ${itemLabel}` : <>prikazano <span className="font-mono text-ink-dim">{from}–{to}</span> od <span className="font-mono text-ink-dim">{total}</span> {itemLabel}</>}
      </span>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} title="prethodna strana">
            <Icon name="chevron-left" />
          </PageLink>
          <span className="px-1.5">
            strana <span className="font-mono text-ink-dim">{page}</span> od <span className="font-mono text-ink-dim">{pageCount}</span>
          </span>
          <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} title="sledeća strana">
            <Icon name="chevron-right" />
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({ href, disabled, title, children }: { href: string; disabled: boolean; title: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled title={title} className="flex h-6 w-6 items-center justify-center rounded text-ink-faint opacity-30">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} title={title} className="flex h-6 w-6 items-center justify-center rounded text-ink-dim hover:bg-panel hover:text-ink">
      {children}
    </Link>
  );
}
