import { QuotaPeriod } from '@prisma/client';

/** M18 spec §6.4/§6.5 — granice tekućeg perioda (DAILY/WEEKLY/MONTHLY), UTC, uvek pun dan/nedelja/mesec. */
export function periodBounds(period: QuotaPeriod, at: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

  if (period === 'DAILY') {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  if (period === 'WEEKLY') {
    // Ponedeljak kao početak nedelje — isti princip kao M18 spec §4.1 WeeklyHealthReview.
    const day = start.getUTCDay(); // 0=nedelja..6=subota
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(start);
    weekStart.setUTCDate(weekStart.getUTCDate() - diffToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    return { start: weekStart, end: weekEnd };
  }

  const monthStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { start: monthStart, end: monthEnd };
}
