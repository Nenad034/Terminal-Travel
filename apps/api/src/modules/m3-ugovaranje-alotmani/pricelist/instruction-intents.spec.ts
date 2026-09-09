import { Namera, StavkaCenovnika, novaCena, primeniNamere } from './instruction-intents';

/**
 * M3 §4.8 — izmena cenovnika rečima, deterministički deo.
 *
 * Vlasnikova rečenica iz specifikacije je merilo: _„cene za sezonu 4 i 5 idu gore 5%, rok za
 * otkazivanje alotmana u sezoni 5 je sada 14 dana umesto 10, uvode doplatu za parking 5 € po
 * sobi po noći koja se plaća na licu mesta, rani buking 2. krug se ukida."_ Četiri izmene, od
 * kojih ovaj tok primenjuje dve, a preostale dve **prijavljuje** umesto da ih prećuti.
 */
describe('instruction-intents (M3 §4.8)', () => {
  const stavka = (over: Partial<StavkaCenovnika> = {}): StavkaCenovnika => ({
    roomType: 'STD',
    seasonCode: '4',
    boardType: 'BB',
    occupancy: '2ADT',
    priceBasis: 'PER_ROOM_PER_NIGHT',
    validWeekdays: [],
    price: 6200, // 62,00
    ...over,
  });

  const namera = (over: Partial<Namera> = {}): Namera => ({
    vrsta: 'CENA_PROCENAT',
    obrazlozenje: 'cene idu gore 5%',
    procenat: 5,
    ...over,
  });

  describe('novaCena — račun radi kod, ne model', () => {
    it('primer iz specifikacije: 62,00 + 5% = 65,10', () => {
      expect(novaCena(6200, namera())).toBe(6510);
    });

    it('sniženje ide istim putem, sa negativnim procentom', () => {
      expect(novaCena(10000, namera({ procenat: -10 }))).toBe(9000);
    });

    it('polovina najmanje jedinice se zaokružuje naviše', () => {
      // 33,33 + 5% = 34,9965 → 3500 (34,99650 zaokruženo na ceo cent).
      expect(novaCena(3333, namera())).toBe(3500);
    });

    it('dodavanje iznosa je druga vrsta namere, ne procenat', () => {
      expect(novaCena(6200, namera({ vrsta: 'CENA_IZNOS', procenat: null, iznosMinor: 500 }))).toBe(
        6700,
      );
    });

    it('nova vrednost zamenjuje staru, bez obzira kolika je bila', () => {
      expect(
        novaCena(6200, namera({ vrsta: 'CENA_NOVA_VREDNOST', procenat: null, iznosMinor: 9000 })),
      ).toBe(9000);
    });

    it('namera bez broja ne daje cenu — model koji nije popunio polje ne sme da proizvede 0', () => {
      expect(novaCena(6200, namera({ procenat: null }))).toBeNull();
      expect(novaCena(6200, namera({ vrsta: 'CENA_IZNOS', iznosMinor: null }))).toBeNull();
    });

    it('decimalan iznos se odbija — cena je ceo broj najmanje jedinice (§2)', () => {
      expect(novaCena(6200, namera({ vrsta: 'CENA_IZNOS', iznosMinor: 5.5 }))).toBeNull();
    });
  });

  describe('domet namere — prazno znači „bez ograničenja", nikad „ni na šta"', () => {
    const cenovnik = [
      stavka({ seasonCode: '4' }),
      stavka({ seasonCode: '5', price: 8000 }),
      stavka({ seasonCode: '6', price: 9000 }),
    ];

    it('dve navedene sezone se menjaju, treća ostaje netaknuta', () => {
      const r = primeniNamere(cenovnik, [namera({ seasonCodes: ['4', '5'] })]);
      expect(r.redovi.map((x) => x.price)).toEqual([6510, 8400, 9000]);
    });

    it('namera bez dometa pogađa ceo cenovnik', () => {
      const r = primeniNamere(cenovnik, [namera()]);
      expect(r.redovi.map((x) => x.price)).toEqual([6510, 8400, 9450]);
    });

    it('oznaka sezone se poredi bez obzira na velika slova i razmake', () => {
      const r = primeniNamere(
        [stavka({ seasonCode: 'Spic' })],
        [namera({ seasonCodes: [' spic '] })],
      );
      expect(r.redovi[0].price).toBe(6510);
    });

    it('domet koji ništa ne pogađa se PRIJAVLJUJE, ne ćuti', () => {
      const r = primeniNamere(cenovnik, [namera({ seasonCodes: ['9'] })]);
      expect(r.redovi.map((x) => x.price)).toEqual([6200, 8000, 9000]);
      expect(r.neprimenjeno[0].razlog).toContain('Nijedna stavka');
    });

    it('tip sobe i pansion sužavaju domet nezavisno', () => {
      const meso = [stavka({ roomType: 'STD' }), stavka({ roomType: 'APP', price: 12000 })];
      const r = primeniNamere(meso, [namera({ roomTypes: ['APP'] })]);
      expect(r.redovi.map((x) => x.price)).toEqual([6200, 12600]);
    });
  });

  describe('redosled namera je redosled odluke', () => {
    it('„sve gore 5%, a studio na 90" daje studio 90,00 — ne 94,50', () => {
      const cenovnik = [stavka({ roomType: 'STD' }), stavka({ roomType: 'APP', price: 12000 })];
      const r = primeniNamere(cenovnik, [
        namera({ obrazlozenje: 'sve gore 5%' }),
        namera({
          vrsta: 'CENA_NOVA_VREDNOST',
          obrazlozenje: 'studio na 90 evra',
          procenat: null,
          iznosMinor: 9000,
          roomTypes: ['STD'],
        }),
      ]);
      expect(r.redovi.find((x) => x.roomType === 'STD')!.price).toBe(9000);
      expect(r.redovi.find((x) => x.roomType === 'APP')!.price).toBe(12600);
    });
  });

  describe('gašenje stavke', () => {
    it('ugašena stavka nestaje iz predloga — poređenje verzija je onda vidi kao ukinutu', () => {
      const cenovnik = [stavka({ seasonCode: '4' }), stavka({ seasonCode: '5' })];
      const r = primeniNamere(cenovnik, [
        namera({ vrsta: 'CENA_GASENJE', procenat: null, seasonCodes: ['5'] }),
      ]);
      expect(r.redovi.map((x) => x.seasonCode)).toEqual(['4']);
    });

    it('kasnija namera ne dira već ugašenu stavku', () => {
      const cenovnik = [stavka({ seasonCode: '4' }), stavka({ seasonCode: '5' })];
      const r = primeniNamere(cenovnik, [
        namera({ vrsta: 'CENA_GASENJE', procenat: null, seasonCodes: ['5'] }),
        namera({ seasonCodes: ['5'] }),
      ]);
      expect(r.redovi).toHaveLength(1);
      expect(r.neprimenjeno[0].razlog).toContain('Nijedna stavka');
    });
  });

  describe('cena koja ne bi bila pozitivna se ne primenjuje', () => {
    it('popust od 120% se odbija umesto da napravi besplatan smeštaj', () => {
      const r = primeniNamere([stavka()], [namera({ procenat: -120 })]);
      expect(r.redovi[0].price).toBe(6200);
      expect(r.neprimenjeno[0].razlog).toContain('pozitivan iznos');
    });

    it('kad bi samo deo stavki pao na nulu, ostale prolaze a razlika se prijavljuje', () => {
      const cenovnik = [stavka({ price: 100 }), stavka({ roomType: 'APP', price: 50000 })];
      const r = primeniNamere(cenovnik, [
        namera({ vrsta: 'CENA_IZNOS', procenat: null, iznosMinor: -200 }),
      ]);
      expect(r.redovi.map((x) => x.price)).toEqual([100, 49800]);
      expect(r.neprimenjeno[0].razlog).toContain('1 stavki');
    });
  });

  describe('doplate i ono što ovaj tok ne ume', () => {
    it('nova doplata iz rečenice ide u poseban spisak, ne u cenovne redove', () => {
      const r = primeniNamere(
        [stavka()],
        [
          namera({
            vrsta: 'DOPLATA_NOVA',
            obrazlozenje: 'uvode doplatu za parking 5 € po sobi po noći',
            procenat: null,
            doplata: {
              name: 'Parking',
              kind: 'SURCHARGE',
              pricingMode: 'FLAT_PER_UNIT',
              flatAmount: 500,
              priceBasis: 'PER_ROOM_PER_NIGHT',
              payable: 'ON_SITE',
              isMandatory: false,
            },
          }),
        ],
      );
      expect(r.noveDoplate).toHaveLength(1);
      expect(r.noveDoplate[0].name).toBe('Parking');
      expect(r.redovi[0].price).toBe(6200); // cene netaknute
    });

    it('doplata bez dovoljno podataka se prijavljuje, ne dodaje se poluprazna', () => {
      const r = primeniNamere(
        [stavka()],
        [namera({ vrsta: 'DOPLATA_NOVA', procenat: null, doplata: null })],
      );
      expect(r.noveDoplate).toHaveLength(0);
      expect(r.neprimenjeno[0].razlog).toContain('ne vidi dovoljno');
    });

    it('ukidanje doplate traži naziv — bez njega se ne pogađa koja je', () => {
      const r = primeniNamere(
        [stavka()],
        [namera({ vrsta: 'DOPLATA_GASENJE', procenat: null, nazivDoplate: '  ' })],
      );
      expect(r.ugaseneDoplate).toHaveLength(0);
      expect(r.neprimenjeno[0].razlog).toContain('koja doplata');
    });

    it('izmena koju ovaj tok ne ume (rok otkazivanja) se prijavljuje sa uputstvom', () => {
      const r = primeniNamere(
        [stavka()],
        [
          namera({
            vrsta: 'NEPODRZANO',
            obrazlozenje: 'rok za otkazivanje alotmana u sezoni 5 je sada 14 dana',
            procenat: null,
            nepodrzanoObjasnjenje: 'Rokovi otkazivanja se menjaju na ekranu perioda.',
          }),
        ],
      );
      expect(r.neprimenjeno[0].razlog).toContain('ekranu perioda');
      expect(r.redovi[0].price).toBe(6200);
    });

    it('vlasnikova rečenica sa četiri izmene: dve se primenjuju, dve se prijavljuju', () => {
      const cenovnik = [stavka({ seasonCode: '4' }), stavka({ seasonCode: '5', price: 8000 })];
      const r = primeniNamere(cenovnik, [
        namera({ obrazlozenje: 'cene za sezonu 4 i 5 idu gore 5%', seasonCodes: ['4', '5'] }),
        namera({
          vrsta: 'NEPODRZANO',
          obrazlozenje: 'rok za otkazivanje alotmana u sezoni 5 je sada 14 dana umesto 10',
          procenat: null,
          nepodrzanoObjasnjenje: 'Rokovi otkazivanja se menjaju na ekranu perioda.',
        }),
        namera({
          vrsta: 'DOPLATA_NOVA',
          obrazlozenje: 'uvode doplatu za parking 5 € po sobi po noći, plaća se na licu mesta',
          procenat: null,
          doplata: {
            name: 'Parking',
            kind: 'SURCHARGE',
            pricingMode: 'FLAT_PER_UNIT',
            flatAmount: 500,
            priceBasis: 'PER_ROOM_PER_NIGHT',
            payable: 'ON_SITE',
            isMandatory: false,
          },
        }),
        namera({
          vrsta: 'NEPODRZANO',
          obrazlozenje: 'rani buking 2. krug se ukida',
          procenat: null,
          nepodrzanoObjasnjenje: 'Akcije se gase na ekranu ponuda perioda.',
        }),
      ]);

      expect(r.redovi.map((x) => x.price)).toEqual([6510, 8400]);
      expect(r.noveDoplate).toHaveLength(1);
      expect(r.neprimenjeno).toHaveLength(2);
      expect(r.neprimenjeno.map((x) => x.obrazlozenje)).toEqual([
        'rok za otkazivanje alotmana u sezoni 5 je sada 14 dana umesto 10',
        'rani buking 2. krug se ukida',
      ]);
    });
  });
});
