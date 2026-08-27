'use client';

import { useEffect } from 'react';
import { useRowSummary } from '@/components/RowSummaryContext';
import { buildDaySummary } from './build-day-summary';
import type { DayDetail } from './types';

/**
 * Adapter za Server Component ("Dan" prikaz kalendara ne može direktno da zove hook) — isti
 * obrazac kao `RegisterTab.tsx`. Gura agregiran sažetak dana u `RowSummaryContext` čim se Dan
 * prikaz montira/promeni datum (27.8.2026, na zahtev vlasnika: "kada kliknemo na stavku
 * kalendara u desnom panelu treba da se pojavi sumarni izveštaj"). Klik na drugačiji dan (ili
 * na red liste rezervacija negde drugde) prirodno ZAMENjuje sažetak — isti kontekst, jedna
 * aktivna vrednost u isto vreme.
 */
export default function RegisterDaySummary({ date, detail }: { date: string; detail: DayDetail }) {
  const { showSummary } = useRowSummary();

  useEffect(() => {
    showSummary(buildDaySummary(date, detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, JSON.stringify(detail)]);

  return null;
}
