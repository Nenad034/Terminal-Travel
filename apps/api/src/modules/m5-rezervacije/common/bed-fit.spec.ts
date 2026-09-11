import { BadRequestException } from '@nestjs/common';
import { assertBedCombinationAllowed, BedsDefinition } from './bed-fit';

const SOBA_2_1: BedsDefinition = {
  baseBeds: 2,
  extraBedsMax: 1,
  extraBedMaxAge: null,
  sharesBedMaxAge: null,
};

const proveri = (ulaz: Partial<Parameters<typeof assertBedCombinationAllowed>[0]>) =>
  assertBedCombinationAllowed({
    adults: 2,
    childrenAges: [],
    beds: SOBA_2_1,
    roomTypeCode: 'DBL',
    ...ulaz,
  });

describe('M5 §3.2a — raspored po krevetima (M2 §2.3g)', () => {
  it('prolazi kombinaciju koju soba prima', () => {
    expect(() => proveri({ adults: 2, childrenAges: [8] })).not.toThrow();
    expect(() => proveri({ adults: 3, childrenAges: [] })).not.toThrow();
    expect(() => proveri({ adults: 1, childrenAges: [8, 10] })).not.toThrow();
  });

  it('odbija grupu za koju nema lezajnih mesta, i kaze zasto', () => {
    expect(() => proveri({ adults: 2, childrenAges: [8, 10] })).toThrow(BadRequestException);
    try {
      proveri({ adults: 2, childrenAges: [8, 10] });
    } catch (e) {
      expect((e as Error).message).toContain('DBL');
      expect((e as Error).message).toContain('nema toliko ležajnih mesta');
    }
  });

  // Izlazni kriterijum M5 §13: "kombinacija označena allowed = false se odbija ... uz jasnu
  // poruku koja kombinacija nije dozvoljena".
  it('odbija kombinaciju koju je hotel izricito zabranio, i imenuje je', () => {
    const ulaz = {
      adults: 1,
      childrenAges: [8, 10],
      bedCombinations: [{ key: '1A_2C', allowed: false, note: 'hotel trazi dve odrasle osobe' }],
    };
    expect(() => proveri(ulaz)).toThrow(BadRequestException);
    try {
      proveri(ulaz);
    } catch (e) {
      expect((e as Error).message).toContain('1A_2C');
      expect((e as Error).message).toContain('hotel trazi dve odrasle osobe');
    }
  });

  it('zabrana jedne kombinacije ne dira ostale', () => {
    const bedCombinations = [{ key: '1A_2C', allowed: false }];
    expect(() => proveri({ adults: 2, childrenAges: [8], bedCombinations })).not.toThrow();
    expect(() => proveri({ adults: 3, childrenAges: [], bedCombinations })).not.toThrow();
  });

  it('prazan bed_combinations[] znaci sve dozvoljeno, nikad nijedna', () => {
    expect(() => proveri({ adults: 1, childrenAges: [8, 10], bedCombinations: [] })).not.toThrow();
    expect(() =>
      proveri({ adults: 1, childrenAges: [8, 10], bedCombinations: null }),
    ).not.toThrow();
  });

  describe('dete koje deli krevet (M2 §2.3b, shares_bed_max_age)', () => {
    const saDeljenjem: BedsDefinition = { ...SOBA_2_1, extraBedsMax: 0, sharesBedMaxAge: 2.99 };

    // Ovo je razlog zasto se deljenje racuna iz SOBINE uzrasne granice, a ne iz odstupanja:
    // nijedan proizvod danas nema nijedan zapis u bed_combinations[] (izmereno 0/225), pa bi
    // suprotno resenje odbilo svaku bebu u punoj sobi.
    it('beba u punoj sobi prolazi bez ijednog unetog odstupanja', () => {
      expect(() => proveri({ adults: 2, childrenAges: [1], beds: saDeljenjem })).not.toThrow();
    });

    it('dete iznad granice deljenja ne prolazi kad nema slobodnog kreveta', () => {
      expect(() => proveri({ adults: 2, childrenAges: [6], beds: saDeljenjem })).toThrow(
        BadRequestException,
      );
    });

    it('soba koja ne dozvoljava deljenje odbija i bebu kad nema kreveta', () => {
      expect(() =>
        proveri({ adults: 2, childrenAges: [1], beds: { ...SOBA_2_1, extraBedsMax: 0 } }),
      ).toThrow(BadRequestException);
    });

    it('shared_bed_children iz odstupanja je DODATNA dozvola povrh uzrasne granice', () => {
      const beds = { ...SOBA_2_1, extraBedsMax: 0, sharesBedMaxAge: null };
      expect(() =>
        proveri({
          adults: 2,
          childrenAges: [6],
          beds,
          bedCombinations: [{ key: '2A_0C', shared_bed_children: 1 }],
        }),
      ).not.toThrow();
    });

    it('deljenje je mogucnost, ne obaveza — dete koje sme da deli sme i svoj krevet', () => {
      // 1 odrasla + 1 beba u sobi 2+1: prolazi i kao 1A_1C (beba na krevetu) i kao 1A_0C
      // (beba deli). Bitno je da prolazi, ne koji od ta dva.
      expect(() =>
        proveri({ adults: 1, childrenAges: [1], beds: { ...SOBA_2_1, sharesBedMaxAge: 2.99 } }),
      ).not.toThrow();
    });
  });

  describe('uzrasna granica pomocnog kreveta (M2 §2.3b, extra_bed_max_age)', () => {
    const doSedam: BedsDefinition = { ...SOBA_2_1, extraBedMaxAge: 7 };

    it('dete u granici prolazi na pomocnom krevetu', () => {
      expect(() => proveri({ adults: 2, childrenAges: [6], beds: doSedam })).not.toThrow();
    });

    it('dete iznad granice se odbija iako ima slobodno pomocno mesto, i poruka kaze granicu', () => {
      expect(() => proveri({ adults: 2, childrenAges: [9], beds: doSedam })).toThrow(
        BadRequestException,
      );
      try {
        proveri({ adults: 2, childrenAges: [9], beds: doSedam });
      } catch (e) {
        expect((e as Error).message).toContain('do 7 godina');
        expect((e as Error).message).toContain('dete od 9');
      }
    });

    it('starije dete prolazi kad za njega ima OSNOVNI krevet', () => {
      // 1 odrasla + 1 dete (9) u sobi 2+1 — dete ide na osnovni, pomocni ostaje prazan.
      expect(() => proveri({ adults: 1, childrenAges: [9], beds: doSedam })).not.toThrow();
    });

    it('od dvoje dece na pomocni ide MLADJE — redosled unosa ne menja ishod', () => {
      // 1 odrasla + deca 9 i 5: 9 na osnovni, 5 na pomocni -> prolazi granicu 7.
      expect(() => proveri({ adults: 1, childrenAges: [9, 5], beds: doSedam })).not.toThrow();
      expect(() => proveri({ adults: 1, childrenAges: [5, 9], beds: doSedam })).not.toThrow();
    });
  });

  describe('kad se provera NE primenjuje', () => {
    it('soba bez unetih kreveta ne tvrdi nista', () => {
      expect(() => proveri({ adults: 9, childrenAges: [1, 2, 3], beds: null })).not.toThrow();
      expect(() => proveri({ adults: 9, childrenAges: [], beds: undefined })).not.toThrow();
      expect(() =>
        proveri({ adults: 9, childrenAges: [], beds: { ...SOBA_2_1, baseBeds: 0 } }),
      ).not.toThrow();
    });

    it('min_occupancy suzava matricu, pa grupa ispod granice ne prolazi', () => {
      expect(() => proveri({ adults: 1, childrenAges: [], minOccupancy: 2 })).toThrow(
        BadRequestException,
      );
      expect(() => proveri({ adults: 2, childrenAges: [], minOccupancy: 2 })).not.toThrow();
    });
  });
});
