import { BadRequestException } from '@nestjs/common';
import { parseRoomTypes, resolveRoomTypeOrThrow } from './room-types';
import { assertRoomCapacity } from './occupancy';

// Oblik koji STVARNO stoji u bazi — snake_case, isti kakav pišu i panel i uvoz cenovnika.
// Prepisan iz `products.attributes->'room_types'->0` nad razvojnom bazom, 11.9.2026.
const IZ_BAZE = {
  room_types: [
    {
      code: 'DBL',
      name: 'Dvokrevetna soba',
      capacity_adults: 2,
      capacity_children: 1,
      beds: {
        base_beds: 2,
        base_bed_type: 'DVA_ODVOJENA_KREVETA',
        extra_bed_type: 'POMOCNI_LEZAJ',
        extra_beds_max: 1,
        extra_bed_max_age: 11.99,
        shares_bed_max_age: 5.99,
      },
    },
  ],
};

describe('parseRoomTypes — snake_case iz baze u oblik koji M5 koristi', () => {
  it('čita kapacitet koji je do 11.9.2026 bio undefined', () => {
    const [soba] = parseRoomTypes(IZ_BAZE);
    expect(soba.capacityAdults).toBe(2);
    expect(soba.capacityChildren).toBe(1);
    expect(soba.name).toBe('Dvokrevetna soba');
  });

  it('čita krevete, uključujući obe uzrasne granice', () => {
    const [soba] = parseRoomTypes(IZ_BAZE);
    expect(soba.beds).toEqual({
      baseBeds: 2,
      extraBedsMax: 1,
      extraBedMaxAge: 11.99,
      sharesBedMaxAge: 5.99,
    });
  });

  /**
   * Ovo je test zbog kog ceo fajl postoji. Pre normalizacije se `attributes.room_types` čitao
   * pukim `as RoomTypeDefinition[]` castom — `tsc` to propušta jer `as` ne proverava ništa —
   * pa je `capacityAdults` bio `undefined` na svakoj stvarnoj sobi. Poređenje `3 > undefined`
   * je `false`, pa bi provera kapaciteta propuštala SVE, izgledajući kao da radi.
   */
  it('bez normalizacije bi provera kapaciteta propustila svaku grupu', () => {
    const sirovaSoba = IZ_BAZE.room_types[0] as unknown as Parameters<typeof assertRoomCapacity>[1];
    const prevelikaGrupa = { adults: 9, children: 0, childrenAges: null };

    // Zatečeno ponašanje: prolazi, iako je soba dvokrevetna.
    expect(() => assertRoomCapacity(prevelikaGrupa, sirovaSoba)).not.toThrow();

    // Posle normalizacije: odbija se.
    expect(() => assertRoomCapacity(prevelikaGrupa, parseRoomTypes(IZ_BAZE)[0])).toThrow(
      BadRequestException,
    );
  });

  it('prima i camelCase oblik, da stariji ili testni zapis ne pukne', () => {
    const [soba] = parseRoomTypes({
      roomTypes: [{ code: 'SGL', capacityAdults: 1, capacityChildren: 0 }],
    });
    expect(soba.capacityAdults).toBe(1);
  });

  it('soba bez unetog kapaciteta prima nikoga, ne svakoga', () => {
    const [soba] = parseRoomTypes({ room_types: [{ code: 'X' }] });
    expect(soba.capacityAdults).toBe(0);
    expect(soba.capacityChildren).toBe(0);
  });

  it('čita uzrasnu politiku sobe (do sada nikad nije stizala do obračuna cene)', () => {
    const [soba] = parseRoomTypes({
      room_types: [
        {
          code: 'DBL',
          capacity_adults: 2,
          capacity_children: 1,
          age_policy: [
            { category: 'ADULT', age_from: 12, age_to: null, counts_toward_capacity: true },
            {
              category: 'CHILD',
              age_from: 2,
              age_to: 6.99,
              counts_toward_capacity: true,
              max_count: 1,
            },
          ],
        },
      ],
    });
    expect(soba.agePolicy).toHaveLength(2);
    expect(soba.agePolicy?.[1]).toMatchObject({ category: 'CHILD', ageTo: 6.99, maxCount: 1 });
  });

  it('čita odstupanja matrice, sa podrazumevanim vrednostima', () => {
    const [soba] = parseRoomTypes({
      room_types: [
        {
          code: 'DBL',
          capacity_adults: 2,
          capacity_children: 1,
          bed_combinations: [{ key: '1A_2C', allowed: false }, { key: '2A_1C' }],
        },
      ],
    });
    expect(soba.bedCombinations).toEqual([
      { key: '1A_2C', allowed: false, shared_bed_children: 0, note: null },
      { key: '2A_1C', allowed: true, shared_bed_children: 0, note: null },
    ]);
  });

  it('besmislen ili prazan ulaz daje prazan spisak, ne puca', () => {
    expect(parseRoomTypes(null)).toEqual([]);
    expect(parseRoomTypes({})).toEqual([]);
    expect(parseRoomTypes({ room_types: 'ne-niz' })).toEqual([]);
    expect(parseRoomTypes({ room_types: [{ name: 'bez sifre' }] })).toEqual([]);
  });
});

describe('resolveRoomTypeOrThrow — nepoznat tip sobe se odbija, ne dobija kapacitet 99', () => {
  const sobe = parseRoomTypes(IZ_BAZE);

  it('vraća sobu kad se šifra poklopi', () => {
    expect(resolveRoomTypeOrThrow(sobe, 'DBL', 'p-1').capacityAdults).toBe(2);
  });

  it('odbija nepoklopljenu šifru i imenuje je, umesto da pretpostavi kapacitet', () => {
    expect(() => resolveRoomTypeOrThrow(sobe, 'Deluxe suite', 'p-1')).toThrow(BadRequestException);
    try {
      resolveRoomTypeOrThrow(sobe, 'Deluxe suite', 'p-1');
    } catch (e) {
      expect((e as Error).message).toContain('Deluxe suite');
      expect((e as Error).message).toContain('§2.11m');
    }
  });
});
