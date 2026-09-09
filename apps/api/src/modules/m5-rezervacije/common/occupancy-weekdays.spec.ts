import { BadRequestException } from '@nestjs/common';
import { computeRoomBaseCostPoNocima } from './occupancy';

/**
 * M3 §2.11d — cena boravka kad kombinacija ima više cenovnih redova sa različitim danima.
 *
 * Primer je vlasnikov: hotel kod koga „vikend" znači petak i subota. Vikend cena je drugi
 * cenovni red, ne nova sezona — pa boravak subota→subota prelazi preko oba reda.
 */
describe('computeRoomBaseCostPoNocima (M3 §2.11d)', () => {
  const soba = { adults: 2, children: 0, childrenAges: [] as number[] };
  const tipSobe = { code: 'STD', capacityAdults: 4, capacityChildren: 2 };

  const radni = {
    id: 'rl-radni',
    price: 10000, // 100,00
    priceBasis: 'PER_ROOM_PER_NIGHT' as const,
    occupancy: '2ADT',
    cribFeePerNight: null,
    validWeekdays: [7, 1, 2, 3, 4],
    agePricing: [],
  };
  const vikend = {
    id: 'rl-vikend',
    price: 14000, // 140,00
    priceBasis: 'PER_ROOM_PER_NIGHT' as const,
    occupancy: '2ADT',
    cribFeePerNight: null,
    validWeekdays: [5, 6],
    agePricing: [],
  };

  it('boravak subota→subota se računa po oba reda: 5 radnih + 2 vikend noći', () => {
    const r = computeRoomBaseCostPoNocima({
      room: soba,
      roomType: tipSobe,
      lines: [radni, vikend],
      stayFrom: new Date('2027-06-12T00:00:00Z'), // subota
      stayTo: new Date('2027-06-19T00:00:00Z'), // subota, 7 noći
    });
    // Noći: sub(vikend), ned, pon, uto, sre, čet (radni), pet(vikend) → 5 × 100 + 2 × 140.
    expect(r.baseCost).toBe(78000);
    // Stavka nosi red koji pokriva PRVU noć — subota je vikend red.
    expect(r.rateLineId).toBe('rl-vikend');
  });

  it('kombinacija sa jednim redom daje isti rezultat kao pre §2.11d', () => {
    const jedan = { ...radni, id: 'rl-svi', validWeekdays: [] as number[] };
    const r = computeRoomBaseCostPoNocima({
      room: soba,
      roomType: tipSobe,
      lines: [jedan],
      stayFrom: new Date('2027-06-12T00:00:00Z'),
      stayTo: new Date('2027-06-19T00:00:00Z'),
    });
    expect(r.baseCost).toBe(70000); // 7 × 100,00
    expect(r.rateLineId).toBe('rl-svi');
  });

  it('boravak koji ostane bez cene za jednu noć se ODBIJA, i poruka imenuje dan', () => {
    expect(() =>
      computeRoomBaseCostPoNocima({
        room: soba,
        roomType: tipSobe,
        lines: [radni], // petak i subota nisu pokriveni
        stayFrom: new Date('2027-06-12T00:00:00Z'),
        stayTo: new Date('2027-06-19T00:00:00Z'),
      }),
    ).toThrow(BadRequestException);

    try {
      computeRoomBaseCostPoNocima({
        room: soba,
        roomType: tipSobe,
        lines: [radni],
        stayFrom: new Date('2027-06-12T00:00:00Z'),
        stayTo: new Date('2027-06-19T00:00:00Z'),
      });
    } catch (e) {
      expect((e as BadRequestException).message).toContain('petak');
      expect((e as BadRequestException).message).toContain('subota');
    }
  });

  it('cena za CEO BORAVAK se naplaćuje jednom, ne po svakoj grupi dana', () => {
    const radniBoravak = { ...radni, priceBasis: 'PER_ROOM_PER_STAY' as const, price: 50000 };
    const vikendBoravak = { ...vikend, priceBasis: 'PER_ROOM_PER_STAY' as const, price: 60000 };
    const r = computeRoomBaseCostPoNocima({
      room: soba,
      roomType: tipSobe,
      lines: [radniBoravak, vikendBoravak],
      stayFrom: new Date('2027-06-12T00:00:00Z'),
      stayTo: new Date('2027-06-19T00:00:00Z'),
    });
    // Prva noć je subota → vikend red; drugi red se NE dodaje, inače bi boravak bio plaćen dvaput.
    expect(r.baseCost).toBe(60000);
  });

  it('boravak bez noći se odbija — dan odjave nije noć', () => {
    expect(() =>
      computeRoomBaseCostPoNocima({
        room: soba,
        roomType: tipSobe,
        lines: [radni],
        stayFrom: new Date('2027-06-14T00:00:00Z'),
        stayTo: new Date('2027-06-14T00:00:00Z'),
      }),
    ).toThrow(BadRequestException);
  });
});
