'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import type { NavItem } from '@/lib/nav';

interface HomeSummary {
  expiringReleasesCount: number | null;
  securityAlertsCount: number | null;
  guaranteeStatus: string | null;
  agentInboxTotal: number | null;
}

// Isti curiran spisak kao ranija "brze prečice" ideja iz AiChatBox-a (napuštena u
// međuvremenu tokom redizajna AI chat-a) — najčešće korišćeni ekrani za brz start dana.
const QUICK_LINK_IDS = ['pretraga', 'rezervacije-lista', 'katalog', 'crm', 'podrska'];

// Puni prazan prostor levog panela za "Početna" (26.8.2026, na zahtev vlasnika, uz snimak
// ekrana GitLens-ove "Get Started" table kao primer: "osmisliti šta možemo ovde da
// prikazujemo a što je važno za prikaz poslovanja") — isti mehanizam kao
// `SearchSidebarPanel.tsx`/`SavedViewsSidebarPanel.tsx` (`Sidebar.tsx` bira po `selected.id`).
// Vlasnikova odluka preko `AskUserQuestion`: "i sažetak i brzi linkovi" — dva odvojena bloka:
// (1) sažetak ISTIH podataka koje glavni dashboard (`app/(app)/page.tsx`, M17 spec §5) već
// učitava (preko nove `/api/home-summary` BFF rute, jer je ovo klijentska komponenta), (2)
// kratak spisak najčešće korišćenih ekrana. Ništa novo se ne agregira — samo se postojeći
// brojevi sažimaju za levu traku.
export default function HomeSidebarPanel({ items }: { items: NavItem[] }) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/home-summary', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Naslov jasno imenuje IZVOR (26.8.2026, na zahtev vlasnika: "nije mi jasno napisano hoću da
  // piše Agent Inbox") — ranije je red pisao samo "N stavki čeka odobrenje", bez imena izvora.
  const rows: { icon: string; label: string; href: string; tone: 'warn' | 'danger' | 'ink' }[] = [];
  if (summary?.securityAlertsCount) {
    rows.push({ icon: 'shield', label: `${summary.securityAlertsCount} bezbednosnih upozorenja`, href: '/audit-log', tone: 'danger' });
  }
  if (summary?.expiringReleasesCount) {
    rows.push({ icon: 'file-text', label: `${summary.expiringReleasesCount} rokova povrata alotmana`, href: '/dobavljaci', tone: 'warn' });
  }
  if (summary?.agentInboxTotal) {
    rows.push({ icon: 'inbox', label: `Agent Inbox: ${summary.agentInboxTotal} na čekanju`, href: '/', tone: 'warn' });
  }
  if (summary?.guaranteeStatus) {
    rows.push({ icon: 'law', label: `Garancija putovanja: ${summary.guaranteeStatus}`, href: '/compliance', tone: 'ink' });
  }

  const quickLinks = QUICK_LINK_IDS.map((id) => items.find((i) => i.id === id)).filter((i): i is NavItem => Boolean(i));

  return (
    <div className="mx-2 mt-1 flex flex-col gap-4">
      <div>
        <div className="mb-1.5 px-2 text-[11px] font-medium text-ink-faint">Sažetak</div>
        {summary === null ? (
          <p className="px-2 text-[11px] text-ink-faint">Učitavanje…</p>
        ) : rows.length === 0 ? (
          <p className="px-2 text-[11px] text-ink-faint">Nema upozorenja za vašu ulogu.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <SummaryCard key={r.label} {...r} />
            ))}
          </div>
        )}
      </div>

      {quickLinks.length > 0 && (
        <div>
          <div className="mb-1.5 px-2 text-[11px] font-medium text-ink-faint">Brzi linkovi</div>
          <div className="flex flex-col gap-1.5">
            {quickLinks.map((item) => (
              <QuickLinkCard key={item.id} icon={item.icon} label={item.label} href={item.href} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TONE_CHIP: Record<'warn' | 'danger' | 'ink', string> = {
  danger: 'bg-danger-bg text-danger',
  warn: 'bg-warn-bg text-warn',
  ink: 'bg-panel2 text-ink-dim',
};

// Kartice umesto ravnih redova (26.8.2026, na zahtev vlasnika: "Stavite linkove u neke lepe
// kartice kao što je to u VS Code") — isti "kartica" jezik kao VS Code Welcome stranica
// (ikonica u obojenoj značci + tekst pored, uokviren pravougaonik), ista `rounded-lg border
// border-border bg-panel p-2` osnova koja se već koristi za kartice drugde u panelu (npr.
// `RightPanel.tsx` `SelectionRow`/`CollectedItemRow`) — dosledan vizuelni jezik, ne nov obrazac.
function SummaryCard({ icon, label, href, tone }: { icon: string; label: string; href: string; tone: 'warn' | 'danger' | 'ink' }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg border border-border bg-panel p-2 hover:border-accent">
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${TONE_CHIP[tone]}`}>
        <Icon name={icon} />
      </span>
      <span className="truncate text-xs font-medium text-ink">{label}</span>
    </Link>
  );
}

function QuickLinkCard({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg border border-border bg-panel p-2 hover:border-accent">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
        <Icon name={icon} />
      </span>
      <span className="truncate text-xs font-medium text-ink">{label}</span>
    </Link>
  );
}
