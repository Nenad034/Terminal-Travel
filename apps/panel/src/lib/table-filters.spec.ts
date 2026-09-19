import {
  applyPills,
  bucketStart,
  chooseBucket,
  histogram,
  invertPill,
  nextBucket,
  pillForCell,
  pillLabel,
  pillsToTransform,
  upsertPill,
  type FilterPill,
} from './table-filters';
import type { TableColumn, TableRow } from './table-spec';

// M17 spec §6e.3 K1/K2 — trakice i histogram su kod, ne model; ponašanje je zato testirano.
const columns: TableColumn[] = [
  { key: 'broj', label: 'Broj', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'dolazak', label: 'Dolazak', type: 'date' },
  { key: 'prodajna', label: 'Prodajna', type: 'money' },
];

const rows: TableRow[] = [
  { _key: '1', broj: 'A', status: 'CONFIRMED', dolazak: '2026-09-13', prodajna: 72450 },
  { _key: '2', broj: 'B', status: 'COMPLETED', dolazak: '2026-09-09', prodajna: 362250 },
  {
    _key: '3',
    broj: 'C',
    status: 'CONFIRMED',
    dolazak: '2026-10-21T00:00:00.000Z',
    prodajna: 11800,
  },
  { _key: '4', broj: 'D', status: null, dolazak: null, prodajna: 0 },
];

describe('applyPills', () => {
  it('jednako / nije po tekstu', () => {
    const is: FilterPill = { column: 'status', op: 'is', value: 'CONFIRMED', enabled: true };
    expect(applyPills(rows, [is], columns).map((r) => r.broj)).toEqual(['A', 'C']);
    expect(applyPills(rows, [invertPill(is)], columns).map((r) => r.broj)).toEqual(['B', 'D']);
  });

  it('isključena trakica ne deluje', () => {
    const off: FilterPill = { column: 'status', op: 'is', value: 'CONFIRMED', enabled: false };
    expect(applyPills(rows, [off], columns)).toHaveLength(4);
  });

  it('opseg datuma je uključiv sa obe strane i čita i pun ISO zapis', () => {
    const r: FilterPill = {
      column: 'dolazak',
      op: 'range',
      value: '2026-09-09',
      to: '2026-10-21',
      enabled: true,
    };
    expect(applyPills(rows, [r], columns).map((x) => x.broj)).toEqual(['A', 'B', 'C']);
    expect(applyPills(rows, [{ ...r, to: '2026-09-12' }], columns).map((x) => x.broj)).toEqual([
      'B',
    ]);
  });

  it('opseg novca radi nad parama (sirova vrednost)', () => {
    const r: FilterPill = {
      column: 'prodajna',
      op: 'range',
      value: '10000',
      to: '80000',
      enabled: true,
    };
    expect(applyPills(rows, [r], columns).map((x) => x.broj)).toEqual(['A', 'C']);
  });

  it('prazna vrednost hvata null (prazno) i „nije prazno" ga izbacuje', () => {
    const empty: FilterPill = { column: 'status', op: 'is', value: '', enabled: true };
    expect(applyPills(rows, [empty], columns).map((x) => x.broj)).toEqual(['D']);
    expect(applyPills(rows, [invertPill(empty)], columns)).toHaveLength(3);
  });
});

describe('pillForCell / upsertPill', () => {
  it('datum iz ćelije postaje opseg tog jednog dana', () => {
    expect(pillForCell(columns[2], '2026-10-21T00:00:00.000Z', false)).toEqual({
      column: 'dolazak',
      op: 'range',
      value: '2026-10-21',
      to: '2026-10-21',
      enabled: true,
    });
  });

  it('ista trakica se ne duplira, a novi opseg zamenjuje stari za istu kolonu', () => {
    const a = pillForCell(columns[1], 'CONFIRMED', false);
    let pills = upsertPill([], a);
    pills = upsertPill(pills, { ...a, enabled: true });
    expect(pills).toHaveLength(1);
    pills = upsertPill(pills, pillForCell(columns[2], '2026-09-09', false));
    pills = upsertPill(pills, pillForCell(columns[2], '2026-09-13', false));
    expect(pills.filter((p) => p.op === 'range')).toHaveLength(1);
    expect(pills.find((p) => p.op === 'range')?.value).toBe('2026-09-13');
  });
});

describe('pillLabel / pillsToTransform', () => {
  const fmt = (v: unknown, type: TableColumn['type']) =>
    type === 'money' ? `${(Number(v) / 100).toFixed(2)}` : String(v);

  it('oznake: jednako, nije, opseg, jedan dan, prazno', () => {
    expect(
      pillLabel({ column: 'status', op: 'is', value: 'CONFIRMED', enabled: true }, columns[1], fmt),
    ).toBe('Status: CONFIRMED');
    expect(
      pillLabel({ column: 'status', op: 'is_not', value: '', enabled: true }, columns[1], fmt),
    ).toBe('Status ≠ (prazno)');
    expect(
      pillLabel(
        { column: 'prodajna', op: 'range', value: '10000', to: '80000', enabled: true },
        columns[3],
        fmt,
      ),
    ).toBe('Prodajna: 100.00 – 800.00');
    expect(
      pillLabel(
        { column: 'dolazak', op: 'range', value: '2026-09-09', to: '2026-09-09', enabled: true },
        columns[2],
        fmt,
      ),
    ).toBe('Dolazak: 2026-09-09');
  });

  it('server dobija eq/neq/gte/lte, isključene se preskaču', () => {
    expect(
      pillsToTransform([
        { column: 'status', op: 'is_not', value: 'CANCELLED', enabled: true },
        { column: 'dolazak', op: 'range', value: '2026-09-01', to: '2026-09-30', enabled: true },
        { column: 'broj', op: 'is', value: 'X', enabled: false },
      ]),
    ).toEqual([
      { column: 'status', op: 'neq', value: 'CANCELLED' },
      { column: 'dolazak', op: 'gte', value: '2026-09-01' },
      { column: 'dolazak', op: 'lte', value: '2026-09-30' },
    ]);
  });
});

describe('histogram', () => {
  it('bira korpu po rasponu', () => {
    expect(chooseBucket('2026-09-01', '2026-09-30')).toBe('day');
    expect(chooseBucket('2026-09-01', '2026-12-01')).toBe('week');
    expect(chooseBucket('2026-01-01', '2026-12-01')).toBe('month');
  });

  it('nedelja počinje ponedeljkom, mesec prvim danom', () => {
    expect(bucketStart('2026-09-13', 'week')).toBe('2026-09-07'); // 13.9.2026 je nedelja
    expect(bucketStart('2026-09-07', 'week')).toBe('2026-09-07');
    expect(bucketStart('2026-09-13', 'month')).toBe('2026-09-01');
    expect(nextBucket('2026-12-01', 'month')).toBe('2027-01-01');
  });

  it('broji po korpi, prazne korpe su prisutne, redovi bez datuma se ne broje', () => {
    const h = histogram(rows, 'dolazak');
    expect(h).not.toBeNull();
    expect(h!.bucket).toBe('week'); // 9.9. → 21.10. = 42 dana
    expect(h!.bars.map((b) => b.from)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(h!.bars.map((b) => b.count)).toEqual([2, 0, 0, 0, 0, 0, 1]);
    expect(h!.bars[0].to).toBe('2026-09-13');
  });

  it('vraća null kad kolona nema nijedan datum', () => {
    expect(histogram(rows, 'broj')).toBeNull();
  });
});
