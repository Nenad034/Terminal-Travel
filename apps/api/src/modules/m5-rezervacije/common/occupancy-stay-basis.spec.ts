import { computeRoomBaseCost, jePoBoravku, jePoSobi, RoomTypeDefinition } from './occupancy';

/**
 * M3 §2.11c / M5 §3.2b — cena po BORAVKU se ne množi brojem noćenja.
 *
 * Ovo je jedina razlika koju nove dve osnove uvode u obračun, i jedina koja može tiho da
 * pomnoži cenu sedam puta. Zato ima sopstvene testove uz postojeće, umesto da se osloni na to
 * što `tsc` prolazi.
 */
describe('osnova cene „po boravku" (M3 §2.11c)', () => {
  const roomType: RoomTypeDefinition = { code: 'STD', capacityAdults: 4, capacityChildren: 2 };

  const soba = { adults: 2, children: 0 };

  function cena(
    priceBasis:
      'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT' | 'PER_ROOM_PER_STAY' | 'PER_PERSON_PER_STAY',
    nights: number,
  ) {
    return computeRoomBaseCost({
      room: soba,
      roomType,
      rateLine: { price: 10_000, priceBasis, occupancy: '2', cribFeePerNight: null },
      agePricingCandidates: [],
      nights,
    });
  }

  describe('prepoznavanje osnove', () => {
    it('razlikuje boravak od noći', () => {
      expect(jePoBoravku('PER_ROOM_PER_STAY')).toBe(true);
      expect(jePoBoravku('PER_PERSON_PER_STAY')).toBe(true);
      expect(jePoBoravku('PER_ROOM_PER_NIGHT')).toBe(false);
    });

    it('razlikuje sobu od osobe', () => {
      expect(jePoSobi('PER_ROOM_PER_STAY')).toBe(true);
      expect(jePoSobi('PER_PERSON_PER_STAY')).toBe(false);
    });
  });

  describe('obračun', () => {
    it('po sobi/noć: 100,00 × 7 noći = 700,00', () => {
      expect(cena('PER_ROOM_PER_NIGHT', 7)).toBe(70_000);
    });

    it('po sobi/BORAVKU: 100,00 ostaje 100,00 bez obzira na 7 noći', () => {
      expect(cena('PER_ROOM_PER_STAY', 7)).toBe(10_000);
    });

    it('po osobi/noć: 100,00 × 2 osobe × 7 noći = 1.400,00', () => {
      expect(cena('PER_PERSON_PER_NIGHT', 7)).toBe(140_000);
    });

    it('po osobi/BORAVKU: 100,00 × 2 osobe = 200,00, noći se ne množe', () => {
      expect(cena('PER_PERSON_PER_STAY', 7)).toBe(20_000);
    });

    it('dužina boravka ne menja cenu po boravku — 3 noći i 14 noći daju isto', () => {
      expect(cena('PER_ROOM_PER_STAY', 3)).toBe(cena('PER_ROOM_PER_STAY', 14));
    });

    it('krevetac ostaje PO NOĆI i kad je cena po boravku — polje se tako i zove', () => {
      const sa = computeRoomBaseCost({
        room: { adults: 2, children: 1, childrenAges: [1] },
        roomType,
        rateLine: {
          price: 10_000,
          priceBasis: 'PER_ROOM_PER_STAY',
          occupancy: '2',
          cribFeePerNight: 500,
        },
        agePricingCandidates: [
          {
            ageCategory: 'INFANT',
            occupantIndex: null,
            minAdultsPresent: null,
            pricingMode: 'FLAT_PRICE',
            percentage: null,
            flatPrice: 0,
          } as never,
        ],
        nights: 4,
      });
      // 100,00 za boravak + 4 × 5,00 krevetac = 120,00
      expect(sa).toBe(12_000);
    });
  });
});
