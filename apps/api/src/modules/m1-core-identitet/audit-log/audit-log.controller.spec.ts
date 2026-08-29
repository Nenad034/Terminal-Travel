import { endOfDayIfDateOnly } from './audit-log.controller';

describe('endOfDayIfDateOnly', () => {
  // Nalaz (29.8.2026, uživo pri proveri pretrage po datumu): "do datuma" 2026-08-29 je vraćalo
  // "Nema zapisa" iako je liniju ranije bilo mnogo zapisa tog dana — `to` je parsiran kao UTC
  // ponoć (00:00:00.000Z), pa je isključivao svaki zapis napravljen posle ponoći tog dana.
  it('proširuje datum-bez-vremena na kraj tog dana (23:59:59.999 UTC)', () => {
    const result = endOfDayIfDateOnly('2026-08-29');
    expect(result.toISOString()).toBe('2026-08-29T23:59:59.999Z');
  });

  it('zapis napravljen kasno tog dana i dalje prolazi <= granicu', () => {
    const to = endOfDayIfDateOnly('2026-08-29');
    const lateEntry = new Date('2026-08-29T22:50:49.000Z');
    expect(lateEntry.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  it('ne dira vrednost koja već nosi vreme/ofset', () => {
    const result = endOfDayIfDateOnly('2026-08-29T10:00:00.000Z');
    expect(result.toISOString()).toBe('2026-08-29T10:00:00.000Z');
  });
});
