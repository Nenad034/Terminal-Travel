import { domet, podeliPoNaplati, ulaziUZbir, vazi } from './surcharge-scope';

/**
 * M3 §2.11j/§2.11k — primena doplate i njen uticaj na zbir.
 *
 * Primeri su iz stvarnog cenovnika Aycon 2026: boravišna taksa u tri uzrasna stepena
 * (1,50 / 1,00 / 0,50), večera kao opciona doplata, popust za treću osobu samo u apartmanima.
 */
describe('surcharge-scope (M3 §2.11j/§2.11k)', () => {
  const OSNOVA = {
    seasonId: null,
    contractPeriodId: null,
    appliesToRoomTypes: [] as string[],
    appliesFrom: null,
    appliesTo: null,
    ageFrom: null,
    ageTo: null,
    bookingFrom: null,
    bookingTo: null,
    payable: 'AGENCY' as const,
    isMandatory: false,
  };

  const K = {
    seasonId: 's1',
    contractPeriodId: 'p1',
    roomType: 'Budget double room',
    danBoravka: new Date('2027-07-15T00:00:00Z'),
    danRezervacije: new Date('2026-11-01T00:00:00Z'),
    uzrast: 35 as number | null,
  };

  describe('domet', () => {
    it('najuži popunjen nivo odlučuje', () => {
      expect(domet({ seasonId: null, contractPeriodId: null })).toBe('CONTRACT');
      expect(domet({ seasonId: 's1', contractPeriodId: null })).toBe('SEASON');
      expect(domet({ seasonId: 's1', contractPeriodId: 'p1' })).toBe('PERIOD');
    });
  });

  describe('vazi — domet', () => {
    it('stavka bez dometa važi svuda — postojeći zapisi se ne smeju promeniti', () => {
      expect(vazi(OSNOVA, K)).toBe(true);
    });

    it('stavka vezana za drugu sezonu ne važi', () => {
      expect(vazi({ ...OSNOVA, seasonId: 's2' }, K)).toBe(false);
    });

    it('stavka vezana za drugi period ne važi', () => {
      expect(vazi({ ...OSNOVA, contractPeriodId: 'p9' }, K)).toBe(false);
    });
  });

  describe('vazi — tip sobe', () => {
    it('prazan spisak soba znači SVE sobe', () => {
      expect(vazi({ ...OSNOVA, appliesToRoomTypes: [] }, K)).toBe(true);
    });

    it('popust samo za apartmane ne važi za dvokrevetnu', () => {
      expect(vazi({ ...OSNOVA, appliesToRoomTypes: ['One bedroom apartment'] }, K)).toBe(false);
    });

    it('isti popust važi kad je soba na spisku', () => {
      expect(
        vazi({ ...OSNOVA, appliesToRoomTypes: ['One bedroom apartment', 'Budget double room'] }, K),
      ).toBe(true);
    });
  });

  describe('vazi — datumski opseg same stavke', () => {
    const novogodisnjaVecera = {
      ...OSNOVA,
      appliesFrom: new Date('2027-12-31T00:00:00Z'),
      appliesTo: new Date('2027-12-31T00:00:00Z'),
    };

    it('ne važi za noć van svog datuma', () => {
      expect(vazi(novogodisnjaVecera, K)).toBe(false);
    });

    it('važi tačno na svoj datum, i granica je uključena', () => {
      expect(vazi(novogodisnjaVecera, { ...K, danBoravka: new Date('2027-12-31T00:00:00Z') })).toBe(
        true,
      );
    });
  });

  describe('vazi — prozor rezervisanja gleda datum NASTANKA rezervacije', () => {
    const doKraja2025 = { ...OSNOVA, bookingTo: new Date('2025-12-31T00:00:00Z') };

    it('rezervacija iz 2026. ne dobija stavku koja je važila do kraja 2025.', () => {
      expect(vazi(doKraja2025, K)).toBe(false);
    });

    it('ista stavka važi za rezervaciju iz decembra 2025, iako je boravak 2027.', () => {
      expect(vazi(doKraja2025, { ...K, danRezervacije: new Date('2025-12-20T00:00:00Z') })).toBe(
        true,
      );
    });
  });

  describe('vazi — uzrast (boravišna taksa u tri stepena)', () => {
    const odrasli = { ...OSNOVA, ageFrom: 18, ageTo: null };
    const tinejdzeri = { ...OSNOVA, ageFrom: 12, ageTo: 17.99 };
    const deca = { ...OSNOVA, ageFrom: 0, ageTo: 11.99 };

    it('svaki stepen hvata tačno svoj uzrast', () => {
      expect(vazi(odrasli, { ...K, uzrast: 35 })).toBe(true);
      expect(vazi(tinejdzeri, { ...K, uzrast: 35 })).toBe(false);
      expect(vazi(tinejdzeri, { ...K, uzrast: 14 })).toBe(true);
      expect(vazi(deca, { ...K, uzrast: 14 })).toBe(false);
      expect(vazi(deca, { ...K, uzrast: 8 })).toBe(true);
    });

    it('granica 11,99 pripada deci, 12 tinejdžerima — bez rupe između stepena', () => {
      expect(vazi(deca, { ...K, uzrast: 11.99 })).toBe(true);
      expect(vazi(tinejdzeri, { ...K, uzrast: 12 })).toBe(true);
    });

    it('nepoznat uzrast NE dobija uzrasnu stavku — pogađanje bi naplatilo pogrešan iznos', () => {
      expect(vazi(deca, { ...K, uzrast: null })).toBe(false);
    });

    it('stavka bez uzrasnog opsega važi i kad uzrast nije poznat', () => {
      expect(vazi(OSNOVA, { ...K, uzrast: null })).toBe(true);
    });
  });

  describe('ulaziUZbir — vlasnikova odluka 9.9.2026', () => {
    it('što naplaćujemo mi ulazi u zbir', () => {
      expect(ulaziUZbir({ payable: 'AGENCY' })).toBe(true);
    });

    it('što se plaća u hotelu NE ulazi u zbir', () => {
      expect(ulaziUZbir({ payable: 'ON_SITE' })).toBe(false);
    });

    it('podela zadržava obe strane — ono što se ne naplaćuje mora ostati vidljivo gostu', () => {
      const r = podeliPoNaplati([
        { payable: 'AGENCY' as const, naziv: 'Večera' },
        { payable: 'ON_SITE' as const, naziv: 'Boravišna taksa' },
        { payable: 'ON_SITE' as const, naziv: 'Parking' },
      ]);
      expect(r.uZbiru.map((s) => s.naziv)).toEqual(['Večera']);
      expect(r.naLicuMesta.map((s) => s.naziv)).toEqual(['Boravišna taksa', 'Parking']);
    });
  });
});
