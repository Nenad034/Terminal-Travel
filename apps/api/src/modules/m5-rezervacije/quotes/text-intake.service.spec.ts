import { BadRequestException } from '@nestjs/common';
import { parseAmountMinor, TextIntakeService } from './text-intake.service';

/**
 * M5 spec §3.0j — ponuda iz nalepljenog teksta. Model je lažiran (vraća zadatu strukturu);
 * testira se ono što radi KOD: iznos u najmanjoj jedinici, izvedeni datumi, uloga cene po
 * vrsti teksta, uparivanje objekta po nazivu i mestu, dobavljač, upozorenja.
 */
describe('parseAmountMinor (zamka 10.5)', () => {
  it.each([
    ['1.240,00', 124000],
    ['1,240.00', 124000],
    ['1240', 124000],
    ['1.240', 124000],
    ['980 EUR', 98000],
    ['1 500', 150000],
    ['12,5', 1250],
    ['abc', null],
    [null, null],
  ])('%s → %s', (text, expected) => {
    expect(parseAmountMinor(text as string | null)).toBe(expected);
  });
});

describe('TextIntakeService.extract', () => {
  const PRODUCTS = [
    {
      id: 'p-sun',
      status: 'ACTIVE',
      sourceContractId: 'c1',
      destinationCity: 'Herceg Novi',
      destinationCountry: 'Crna Gora',
      translations: [{ name: 'Hotel Sun Resort' }],
    },
    {
      id: 'p-sun-bg',
      status: 'ACTIVE',
      sourceContractId: 'c2',
      destinationCity: 'Beograd',
      destinationCountry: 'Srbija',
      translations: [{ name: 'Hotel Sun Resort' }],
    },
  ];

  function make(
    modelInput: Record<string, unknown>,
    opts: { period?: boolean; suppliers?: any[] } = {},
  ) {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue(PRODUCTS),
        findUnique: jest
          .fn()
          .mockResolvedValue({ supplierId: null, sourceContract: { supplierId: 's1' } }),
      },
      contractPeriod: {
        findFirst: jest.fn().mockResolvedValue(opts.period ? { id: 'per1' } : null),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue(opts.suppliers ?? []),
        findUnique: jest.fn().mockResolvedValue({ id: 's1', name: 'Sun Resort d.o.o.' }),
      },
      aIAgent: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const anthropic = {
      isConfigured: () => true,
      getClient: () => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            stop_reason: 'tool_use',
            usage: { input_tokens: 1, output_tokens: 1 },
            content: [{ type: 'tool_use', name: 'intake_extraction', input: modelInput }],
          }),
        },
      }),
    };
    const log = { record: jest.fn() };
    return new TextIntakeService(prisma as any, anthropic as any, log as any);
  }

  const base = {
    kind: 'SUPPLIER_OFFER',
    property_name: 'Hotel Sun Resort 4*',
    city: 'Herceg Novi',
    country: null,
    supplier_name: 'Sun Resort',
    stay_from: '2027-06-20',
    stay_to: null,
    nights: 7,
    board: 'HB',
    rooms: [{ room_type_text: 'DBL', adults: 2, children_ages: [5, 9] }],
    price: { amount_text: '1.240,00', currency: 'EUR', basis: 'PER_ROOM', per: 'STAY' },
    valid_until: '2026-09-30',
    notes: null,
    questions: [],
    confidence: 'HIGH',
  };

  it('mejl dobavljača: iznos je NABAVNA, stay_to izveden iz noći, objekat uparen po mestu (ne beogradski istoimeni), dobavljač iz ugovora', async () => {
    const svc = make(base, { period: true });
    const r = await svc.extract('x'.repeat(20));
    expect(r.derived).toMatchObject({
      amountMinor: 124000,
      stayFrom: '2027-06-20',
      stayTo: '2027-06-27',
      adults: 2,
      children: 2,
      priceRole: 'BASE_COST',
    });
    expect(r.match.productId).toBe('p-sun');
    expect(r.match.hasPriceForPeriod).toBe(true);
    expect(r.match.supplierId).toBe('s1');
    expect(r.warnings.some((w) => w.includes('NAŠU ugovorenu cenu'))).toBe(true);
  });

  it('zahtev klijenta: iznos je predlog IZLAZNE cene (§3.0j.7 t. 1); pitanje kad nema datuma', async () => {
    const svc = make({
      ...base,
      kind: 'CLIENT_REQUEST',
      property_name: null,
      supplier_name: null,
      stay_from: null,
      nights: null,
      price: { amount_text: '1.500', currency: 'EUR', basis: null, per: 'STAY' },
      questions: ['Koji su tačni datumi?'],
    });
    const r = await svc.extract('x'.repeat(20));
    expect(r.derived.priceRole).toBe('FINAL_PRICE');
    expect(r.derived.amountMinor).toBe(150000);
    expect(r.match.productId).toBeNull();
    expect(r.extraction.questions).toEqual(['Koji su tačni datumi?']);
  });

  it('nepoznat hotel: nema uparivanja, dobavljač nije prepoznat → upozorenje', async () => {
    const svc = make({
      ...base,
      property_name: 'Villa Aurora Boutique',
      city: 'Rovinj',
      supplier_name: 'Aurora Hospitality',
    });
    const r = await svc.extract('x'.repeat(20));
    expect(r.match.productId).toBeNull();
    expect(r.match.supplierId).toBeNull();
    expect(r.warnings.some((w) => w.includes('Dobavljač iz mejla nije prepoznat'))).toBe(true);
  });

  it('cena po noći → upozorenje da nacrt traži ukupan iznos', async () => {
    const svc = make({
      ...base,
      price: { amount_text: '120', currency: 'EUR', basis: 'PER_ROOM', per: 'NIGHT' },
    });
    const r = await svc.extract('x'.repeat(20));
    expect(r.warnings.some((w) => w.includes('po noći'))).toBe(true);
  });

  it('prekratak tekst i nepodešen AI se odbijaju sa 400', async () => {
    const svc = make(base);
    await expect(svc.extract('kratko')).rejects.toBeInstanceOf(BadRequestException);
    const off = new TextIntakeService({} as any, { isConfigured: () => false } as any, {} as any);
    await expect(off.extract('x'.repeat(20))).rejects.toBeInstanceOf(BadRequestException);
  });
});
