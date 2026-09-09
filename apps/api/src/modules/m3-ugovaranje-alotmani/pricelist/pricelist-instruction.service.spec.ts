import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PricelistInstructionService } from './pricelist-instruction.service';

/**
 * M3 §4.8 — izmena cenovnika rečima.
 *
 * Ovde se ne testira model nego **ograde oko njega** (§4.8.2): da servis ništa ne upisuje, da se
 * model ne pita za račun, da nejasna rečenica proizvodi pitanje umesto pogađanja, i da izmena
 * koju ovaj tok ne ume izlazi kao prijavljena stavka, ne kao tišina.
 */
describe('PricelistInstructionService (M3 §4.8)', () => {
  const UGOVOR = { id: 'c1', contractNumber: 'TT-2026-014', currency: 'EUR' };

  const ZATECENE = [
    {
      roomType: 'STD',
      seasonCode: '4',
      boardType: 'BB',
      occupancy: '2ADT',
      priceBasis: 'PER_ROOM_PER_NIGHT',
      validWeekdays: [],
      price: 6200,
      bookingFrom: null,
      bookingTo: null,
    },
    {
      roomType: 'STD',
      seasonCode: '5',
      boardType: 'BB',
      occupancy: '2ADT',
      priceBasis: 'PER_ROOM_PER_NIGHT',
      validWeekdays: [],
      price: 8000,
      bookingFrom: null,
      bookingTo: null,
    },
  ];

  function makeService(over: Record<string, any> = {}) {
    const create = jest.fn(async (_zahtev: any) => ({
      content: [
        {
          type: 'tool_use',
          input: { izmene: over.izmene ?? [], pitanja: over.pitanja ?? [] },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    }));

    const prisma: any = {
      contract: { findUnique: jest.fn(async () => (over.contract === null ? null : UGOVOR)) },
      ancillaryService: { findMany: jest.fn(async () => over.doplate ?? []) },
      aIAgent: { findFirst: jest.fn(async () => ({ id: 'a1', modelTier: 'LIGHT' })) },
    };
    const anthropic = {
      isConfigured: jest.fn(() => over.konfigurisan !== false),
      getClient: jest.fn(() => ({ messages: { create } })),
    };
    const invocationLog = { record: jest.fn(async () => undefined) };
    const verzije = {
      zateceniRedovi: jest.fn(async () => over.zatecene ?? ZATECENE),
      predlozi: jest.fn(async (_c: string, dto: any) => ({
        razlike: dto.redovi.map((r: any) => ({
          kljuc: `${r.roomType}|${r.seasonCode}`,
          poruka: `${r.roomType} sezona ${r.seasonCode}`,
        })),
        ukupno: dto.redovi.length,
        sviKljucevi: dto.redovi.map((r: any) => `${r.roomType}|${r.seasonCode}`),
      })),
    };

    const service = new PricelistInstructionService(
      prisma,
      anthropic as any,
      invocationLog as any,
      verzije as any,
    );
    return { service, prisma, anthropic, invocationLog, verzije, create };
  }

  const DTO = { instructionText: 'cene za sezonu 4 i 5 idu gore 5%', effectiveFrom: '2027-01-01' };

  describe('ograde pre modela', () => {
    it('ugovor koji ne postoji vraća 404', async () => {
      const { service } = makeService({ contract: null });
      await expect(service.predlozi('c1', DTO as any)).rejects.toThrow(NotFoundException);
    });

    it('bez podešenog AI servisa se ne pretvara da radi — vraća objašnjenje i put ručnog unosa', async () => {
      const { service, create } = makeService({ konfigurisan: false });
      await expect(service.predlozi('c1', DTO as any)).rejects.toThrow(/AI servis nije podešen/);
      expect(create).not.toHaveBeenCalled();
    });

    it('prazan cenovnik se odbija pre poziva modelu — nema šta da se izmeni', async () => {
      const { service, create } = makeService({ zatecene: [] });
      await expect(service.predlozi('c1', DTO as any)).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it('prazna rečenica se odbija', async () => {
      const { service } = makeService();
      await expect(
        service.predlozi('c1', { ...DTO, instructionText: '   ' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('šta model sme, a šta ne', () => {
    it('šema alata NEMA polje za izračunatu cenu — ograda stoji u strukturi, ne u uputstvu', async () => {
      const { service, create } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore 5%', procenat: 5 }],
      });
      await service.predlozi('c1', DTO as any);
      const poziv = (create.mock.calls[0] as any[])[0] as any;
      const polja = poziv.tools[0].input_schema.properties.izmene.items.properties;
      expect(Object.keys(polja)).not.toContain('novaCena');
      expect(Object.keys(polja)).not.toContain('price');
      expect(poziv.tool_choice).toEqual({ type: 'tool', name: 'predlozi_izmene_cenovnika' });
    });

    it('modelu se šalje SAŽETAK cenovnika, ne cela baza', async () => {
      const { service, create } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore 5%', procenat: 5 }],
      });
      await service.predlozi('c1', DTO as any);
      const sadrzaj = ((create.mock.calls[0] as any[])[0] as any).messages[0].content as string;
      expect(sadrzaj).toContain('sezona 4');
      expect(sadrzaj).toContain('cena 62.00');
      expect(sadrzaj).not.toContain('bookingFrom');
    });

    it('namera bez broja se odbacuje posle modela — ne sme da postane cena 0', async () => {
      const { service } = makeService({
        izmene: [
          { vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore', procenat: null },
          { vrsta: 'CENA_IZNOS', obrazlozenje: 'skuplje', iznosMinor: null },
        ],
      });
      const r = await service.predlozi('c1', DTO as any);
      expect(r.namere).toHaveLength(0);
      expect(r.redovi.map((x: any) => x.price)).toEqual([6200, 8000]);
    });

    it('namera bez obrazloženja se odbacuje — čovek mora videti IZ ČEGA je izmena nastala', async () => {
      const { service } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: '  ', procenat: 5 }],
      });
      expect((await service.predlozi('c1', DTO as any)).namere).toHaveLength(0);
    });

    it('procenat 0 se odbacuje — izmena koja ništa ne menja je pogrešno pročitana rečenica', async () => {
      const { service } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore 0%', procenat: 0 }],
      });
      expect((await service.predlozi('c1', DTO as any)).namere).toHaveLength(0);
    });
  });

  describe('predlog', () => {
    it('nove cene računa KOD: 62,00 → 65,10 i 80,00 → 84,00', async () => {
      const { service } = makeService({
        izmene: [
          {
            vrsta: 'CENA_PROCENAT',
            obrazlozenje: 'cene za sezonu 4 i 5 idu gore 5%',
            procenat: 5,
            seasonCodes: ['4', '5'],
          },
        ],
      });
      const r = await service.predlozi('c1', DTO as any);
      expect(r.redovi.map((x: any) => x.price)).toEqual([6510, 8400]);
      expect(r.ukupno).toBe(2);
    });

    it('ništa se ne upisuje — servis nema nijedan poziv koji menja bazu', async () => {
      const { service, prisma, verzije } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore 5%', procenat: 5 }],
      });
      await service.predlozi('c1', DTO as any);
      // Jedini prisma pozivi su čitanja; `predlozi` na servisu verzija takođe ništa ne piše.
      expect(Object.keys(prisma.contract)).toEqual(['findUnique']);
      expect(verzije.predlozi).toHaveBeenCalled();
      expect((verzije as any).primeni).toBeUndefined();
    });

    it('odgovor nosi ŠTA je model razumeo, ne samo ishod', async () => {
      const { service } = makeService({
        izmene: [
          {
            vrsta: 'CENA_PROCENAT',
            obrazlozenje: 'cene za sezonu 4 i 5 idu gore 5%',
            procenat: 5,
          },
        ],
      });
      const r = await service.predlozi('c1', DTO as any);
      expect(r.namere).toEqual([
        { vrsta: 'CENA_PROCENAT', obrazlozenje: 'cene za sezonu 4 i 5 idu gore 5%' },
      ]);
    });

    it('rečenica se vraća uz predlog — ide dalje u verziju (§4.8.2)', async () => {
      const { service } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore 5%', procenat: 5 }],
      });
      expect((await service.predlozi('c1', DTO as any)).instructionText).toBe(DTO.instructionText);
    });

    it('poziv modelu se beleži u nadzor, sa akcijom iz specifikacije', async () => {
      const { service, invocationLog } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore 5%', procenat: 5 }],
      });
      await service.predlozi('c1', DTO as any);
      expect(invocationLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actionCode: 'pricelist.edit_from_instruction' }),
      );
    });
  });

  describe('nejasna rečenica se pita, ne pogađa (§4.4)', () => {
    it('pitanje bez ijedne namere zaustavlja predlog', async () => {
      const { service, verzije } = makeService({
        izmene: [],
        pitanja: ['Na koju sezonu se odnosi poskupljenje?'],
      });
      const r = await service.predlozi('c1', DTO as any);
      expect(r.pitanja).toHaveLength(1);
      expect(r.ukupno).toBe(0);
      expect(verzije.predlozi).not.toHaveBeenCalled();
    });

    it('pitanje uz razumljive izmene ne zaustavlja ostatak — prikazuje se pored predloga', async () => {
      const { service } = makeService({
        izmene: [{ vrsta: 'CENA_PROCENAT', obrazlozenje: 'gore 5%', procenat: 5 }],
        pitanja: ['Da li se to odnosi i na apartmane?'],
      });
      const r = await service.predlozi('c1', DTO as any);
      expect(r.pitanja).toHaveLength(1);
      expect(r.ukupno).toBe(2);
    });
  });

  describe('ono što ovaj tok ne ume se prijavljuje', () => {
    it('rok otkazivanja izlazi kao neprimenjena stavka sa uputstvom', async () => {
      const { service } = makeService({
        izmene: [
          {
            vrsta: 'NEPODRZANO',
            obrazlozenje: 'rok za otkazivanje u sezoni 5 je sada 14 dana',
            nepodrzanoObjasnjenje: 'Rokovi otkazivanja se menjaju na ekranu perioda.',
          },
        ],
      });
      const r = await service.predlozi('c1', DTO as any);
      expect(r.neprimenjeno).toHaveLength(1);
      expect(r.neprimenjeno[0].razlog).toContain('ekranu perioda');
    });

    it('nova doplata izlazi u svom spisku, cene ostaju netaknute', async () => {
      const { service } = makeService({
        izmene: [
          {
            vrsta: 'DOPLATA_NOVA',
            obrazlozenje: 'parking 5 € po sobi po noći, plaća se na licu mesta',
            doplata: {
              name: 'Parking',
              kind: 'SURCHARGE',
              pricingMode: 'FLAT_PER_UNIT',
              flatAmount: 500,
              priceBasis: 'PER_ROOM_PER_NIGHT',
              payable: 'ON_SITE',
              isMandatory: false,
            },
          },
        ],
      });
      const r = await service.predlozi('c1', DTO as any);
      expect(r.noveDoplate).toHaveLength(1);
      expect(r.redovi.map((x: any) => x.price)).toEqual([6200, 8000]);
    });
  });
});
