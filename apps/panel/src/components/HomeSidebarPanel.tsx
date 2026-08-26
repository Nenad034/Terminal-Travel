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

  const rows: { icon: string; label: string; href: string; tone: 'warn' | 'danger' | 'ink' }[] = [];
  if (summary?.securityAlertsCount) {
    rows.push({ icon: 'shield', label: `${summary.securityAlertsCount} bezbednosnih upozorenja`, href: '/audit-log', tone: 'danger' });
  }
  if (summary?.expiringReleasesCount) {
    rows.push({ icon: 'file-text', label: `${summary.expiringReleasesCount} rokova povrata alotmana`, href: '/dobavljaci', tone: 'warn' });
  }
  if (summary?.agentInboxTotal) {
    rows.push({ icon: 'inbox', label: `${summary.agentInboxTotal} stavki čeka odobrenje`, href: '/', tone: 'warn' });
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
          <ul className="flex flex-col gap-1">
            {rows.map((r) => (
              <li key={r.label}>
                <Link
                  href={r.href}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-panel ${
                    r.tone === 'danger' ? 'text-danger' : r.tone === 'warn' ? 'text-warn' : 'text-ink-dim'
                  }`}
                >
                  <Icon name={r.icon} />
                  <span className="truncate">{r.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {quickLinks.length > 0 && (
        <div>
          <div className="mb-1.5 px-2 text-[11px] font-medium text-ink-faint">Brzi linkovi</div>
          <ul className="flex flex-col gap-0.5">
            {quickLinks.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-ink-dim hover:bg-panel hover:text-ink">
                  <Icon name={item.icon} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
