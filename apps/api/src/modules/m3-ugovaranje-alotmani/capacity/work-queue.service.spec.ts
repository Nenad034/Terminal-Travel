import { WorkQueueService } from './work-queue.service';

/**
 * M3 spec §6 `/capacity/work-queue` / M17 §4b.0 — radni spisak. Svaka vrsta reda ima svoj
 * prozor; greška ovde ne pada nego ćuti (red koji fali niko ne vidi), zato po jedan test po vrsti
 * plus „prazan spisak je prazan niz, ne greška".
 */
describe('WorkQueueService (§6, M17 §4b.0)', () => {
  const DANAS = new Date('2026-09-17T08:00:00Z');
  const day = (
    date: string,
    p: Partial<{
      capacity: number | null;
      sold: number;
      razlika: number | null;
      zaProdaju: number;
      saleStatus: 'OPEN' | 'STOP';
      stopReason: string | null;
    }> = {},
  ) => ({
    date,
    capacity: 10,
    sold: 0,
    blocked: 0,
    razlika: 10,
    zaProdaju: 10,
    saleStatus: 'OPEN' as const,
    stopReason: null,
    ...p,
  });
  const row = (days: ReturnType<typeof day>[], extra: Record<string, unknown> = {}) => ({
    contractId: 'c1',
    contractPeriodId: 'p1',
    supplierName: 'Hotel d.o.o.',
    productName: 'Hotel Sun 4*',
    destinationCountry: 'Grčka',
    destinationCity: 'Kasandra',
    productType: 'ACCOMMODATION',
    roomType: 'DBL',
    allotmentMode: 'FIXED',
    days,
    ...extra,
  });

  function make(opts: { rows?: any[]; blocks?: any[]; periods?: any[]; notices?: any[] }) {
    const prisma = {
      capacityBlock: { findMany: jest.fn().mockResolvedValue(opts.blocks ?? []) },
      contractPeriod: { findMany: jest.fn().mockResolvedValue(opts.periods ?? []) },
      offerExpiryNotice: { findMany: jest.fn().mockResolvedValue(opts.notices ?? []) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            sourceContractId: 'c1',
            destinationCountry: 'Grčka',
            destinationCity: 'Kasandra',
            translations: [{ name: 'Hotel Sun 4*' }],
          },
        ]),
      },
    };
    const capacity = { grid: jest.fn().mockResolvedValue({ rows: opts.rows ?? [] }) };
    return { svc: new WorkQueueService(prisma as any, capacity as any), capacity };
  }

  it('prazna baza: prazan niz, ne greška; mreža se čita za kvartal od danas', async () => {
    const { svc, capacity } = make({});
    const r = await svc.build(DANAS);
    expect(r).toEqual({ generatedFor: '2026-09-17', items: [] });
    expect(capacity.grid).toHaveBeenCalledWith({ from: '2026-09-17', to: '2026-12-17' });
  });

  it('prekoračenje: prvi dan sa negativnom razlikom, najgori broj u opisu', async () => {
    const { svc } = make({
      rows: [
        row([
          day('2026-09-17'),
          day('2026-09-18', { sold: 12, razlika: -2, zaProdaju: 0 }),
          day('2026-09-19', { sold: 13, razlika: -3, zaProdaju: 0 }),
        ]),
      ],
    });
    const { items } = await svc.build(DANAS);
    const it = items.find((i) => i.kind === 'OVERBOOKED');
    expect(it).toMatchObject({ date: '2026-09-18', value: 3, roomType: 'DBL' });
    expect(it?.detail).toContain('prodato 12 od 10');
    expect(it?.detail).toContain('najviše 3 preko');
  });

  it('0–2 jedinice u 30 dana; dan posle 30. ne ulazi; ON_REQUEST ne ulazi', async () => {
    const { svc } = make({
      rows: [
        row([
          day('2026-09-20', { razlika: 2, zaProdaju: 2 }),
          day('2026-09-21', { razlika: 1, zaProdaju: 1 }),
        ]),
        row([day('2026-10-25', { razlika: 0, zaProdaju: 0 })], { contractPeriodId: 'p2' }),
        row([day('2026-09-20', { razlika: 0, zaProdaju: 0 })], {
          contractPeriodId: 'p3',
          allotmentMode: 'ON_REQUEST',
        }),
      ],
    });
    const { items } = await svc.build(DANAS);
    const low = items.filter((i) => i.kind === 'LOW_UNITS');
    expect(low).toHaveLength(1);
    expect(low[0]).toMatchObject({ contractPeriodId: 'p1', date: '2026-09-20', value: 1 });
  });

  it('stop-sale koji se otvara: poslednji zatvoren dan u naredna 2 dana; dug stop-sale ne ulazi', async () => {
    const { svc } = make({
      rows: [
        row([
          day('2026-09-17', { saleStatus: 'STOP', zaProdaju: 0, stopReason: 'renoviranje' }),
          day('2026-09-18', { saleStatus: 'STOP', zaProdaju: 0 }),
          day('2026-09-19'),
        ]),
        row(
          [
            day('2026-09-17', { saleStatus: 'STOP', zaProdaju: 0 }),
            day('2026-09-18', { saleStatus: 'STOP', zaProdaju: 0 }),
            day('2026-09-19', { saleStatus: 'STOP', zaProdaju: 0 }),
            day('2026-09-20', { saleStatus: 'STOP', zaProdaju: 0 }),
          ],
          { contractPeriodId: 'p2' },
        ),
      ],
    });
    const { items } = await svc.build(DANAS);
    const s = items.filter((i) => i.kind === 'STOP_SALE_ENDING');
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ contractPeriodId: 'p1', date: '2026-09-18' });
  });

  it('blokada kojoj ističe rok (≤ 2 dana) i već istekla (cron još nije prošao) — obe ulaze', async () => {
    const { svc } = make({
      blocks: [
        {
          id: 'b1',
          contractPeriodId: 'p1',
          units: 4,
          reason: 'Grupa OŠ',
          holdUntil: new Date('2026-09-15T00:00:00Z'),
          contractPeriod: {
            contractId: 'c1',
            roomType: 'DBL',
            contract: { supplier: { name: 'Hotel d.o.o.' } },
          },
        },
      ],
    });
    const { items } = await svc.build(DANAS);
    expect(items[0]).toMatchObject({ kind: 'BLOCK_EXPIRING', date: '2026-09-15', value: 4 });
    expect(items[0].detail).toContain('istekla');
  });

  it('rok povrata: stay_from − release_days_before u narednih 7 dana; neprodato u opisu', async () => {
    const { svc } = make({
      periods: [
        {
          id: 'p1',
          contractId: 'c1',
          roomType: 'DBL',
          stayFrom: new Date('2026-10-01'),
          releaseDaysBefore: 14,
          totalCapacity: 25,
          unitsSold: 5,
          contract: { supplier: { name: 'Hotel d.o.o.' } },
        },
        {
          id: 'p2',
          contractId: 'c1',
          roomType: 'TRP',
          stayFrom: new Date('2026-12-01'),
          releaseDaysBefore: 14,
          totalCapacity: 25,
          unitsSold: 0,
          contract: { supplier: { name: 'Hotel d.o.o.' } },
        },
      ],
    });
    const { items } = await svc.build(DANAS);
    const r = items.filter((i) => i.kind === 'RELEASE_DUE');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ contractPeriodId: 'p1', date: '2026-09-17', value: 20 });
    expect(r[0].detail).toContain('rok povrata 17.9.2026. (14 dana pre 1.10.2026.)');
    expect(r[0].detail).toContain('neprodato 20 od 25');
  });

  it('akcija pred istek: INTERNAL nepotvrđena, sa noticeId za „video"; sortiranje po datumu', async () => {
    const { svc } = make({
      notices: [
        {
          id: 'n1',
          contractId: 'c1',
          contractPeriodId: 'p1',
          productName: 'Hotel Sun 4*',
          destinationCity: 'Kasandra',
          destinationCountry: 'Grčka',
          offerKind: 'EARLY_BOOKING',
          discountSummary: '−15 %',
          bookingTo: new Date('2026-09-24'),
          stayFrom: new Date('2027-06-01'),
          stayTo: new Date('2027-09-30'),
        },
      ],
      rows: [row([day('2026-09-30', { sold: 11, razlika: -1, zaProdaju: 0 })])],
    });
    const { items } = await svc.build(DANAS);
    expect(items.map((i) => i.kind)).toEqual(['OFFER_EXPIRING', 'OVERBOOKED']);
    expect(items[0]).toMatchObject({ noticeId: 'n1', date: '2026-09-24' });
    expect(items[0].detail).toContain('rani buking −15 %');
  });
});
