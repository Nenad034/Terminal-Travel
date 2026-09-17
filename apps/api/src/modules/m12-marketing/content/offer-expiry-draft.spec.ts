import { ContentService } from './content.service';
import { generateOfferExpiryDraft } from './ai-draft-generator';
import { B2bSubagentsAdapter } from '../distribution/adapters/b2b-subagents.adapter';
import {
  M12EventSubscribersService,
  tomorrowAtNine,
} from '../events/m12-event-subscribers.service';

/**
 * M12 spec §3d — akcija pred istek → nacrt objave. Tri stvari koje tiho lažu ako se pokvare:
 * rok mora biti DATUM u tekstu (ne „još 7 dana"), isti događaj ne sme dati dva nacrta, istekla
 * akcija se ne sme objaviti. Plus §4/M7 §5b.3 ograda nad tekstom za subagente.
 */
describe('M12 §3d — nacrt iz akcije pred istek', () => {
  const EVENT = {
    notice_id: 'n1',
    source_type: 'PRICELIST_OFFER' as const,
    source_id: 'o1',
    contract_id: 'c1',
    contract_period_id: 'p1',
    product_id: 'prod1',
    supplier_id: 's1',
    product_name: 'Aegean Breeze 4*',
    destination_country: 'Grčka',
    destination_city: 'Kasandra',
    offer_kind: 'EARLY_BOOKING' as const,
    discount_summary: '−15 %',
    booking_to: '2026-09-30',
    days_left: 7,
    stay_from: '2027-06-01',
    stay_to: '2027-09-30',
    has_subagent_allocations: false,
  };

  it('tekst nosi rok kao datum i period boravka, ne relativan broj dana', () => {
    const d = generateOfferExpiryDraft({
      productName: EVENT.product_name,
      destinationCity: EVENT.destination_city,
      destinationCountry: EVENT.destination_country,
      offerKind: EVENT.offer_kind,
      discountSummary: EVENT.discount_summary,
      bookingTo: EVENT.booking_to,
      stayFrom: EVENT.stay_from,
      stayTo: EVENT.stay_to,
    });
    expect(d.title).toBe('Rani buking −15 % — Aegean Breeze 4*, Kasandra, Grčka');
    expect(d.body).toContain('do 30.9.2026.');
    expect(d.body).toContain('od 1.6.2027. do 30.9.2027.');
    expect(d.body).not.toMatch(/još \d+ dana/i);
  });

  it('sutradan u 9:00', () => {
    const t = tomorrowAtNine(new Date(2026, 8, 17, 15, 42));
    expect([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes()]).toEqual([
      2026, 8, 18, 9, 0,
    ]);
  });

  describe('pretplatnik', () => {
    function make() {
      const content = {
        findLiveDraftForOffer: jest.fn().mockResolvedValue(null),
        createAiDraft: jest.fn().mockResolvedValue({ id: 'cp1' }),
      };
      const listener = { on: jest.fn() };
      const svc = new M12EventSubscribersService(listener as any, content as any, {} as any);
      return { svc, content, listener };
    }

    it('pravi PENDING nacrt sa tri kanala (bez EMAIL), rokom, bravom source_id i ALL_ACTIVE kad nema dodela', async () => {
      const { svc, content } = make();
      await svc.handleOfferExpiring(EVENT);
      expect(content.createAiDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod1',
          targetChannels: ['FACEBOOK', 'INSTAGRAM', 'B2B_SUBAGENTS'],
          trigger: 'pricelist.offer.expiring',
          sourceOfferId: 'o1',
          b2bAudience: 'ALL_ACTIVE',
          offerBookingTo: new Date('2026-09-30'),
        }),
      );
      const args = content.createAiDraft.mock.calls[0][0];
      expect(args.targetChannels).not.toContain('EMAIL');
      expect(args.scheduledPublishAt).toBeInstanceOf(Date);
    });

    it('ASSIGNED_ONLY kad proizvod ima dodele', async () => {
      const { svc, content } = make();
      await svc.handleOfferExpiring({ ...EVENT, has_subagent_allocations: true });
      expect(content.createAiDraft.mock.calls[0][0].b2bAudience).toBe('ASSIGNED_ONLY');
    });

    it('drugi isti događaj ne pravi drugi nacrt dok prvi živi', async () => {
      const { svc, content } = make();
      content.findLiveDraftForOffer.mockResolvedValue({ id: 'cp1', status: 'PENDING_APPROVAL' });
      await svc.handleOfferExpiring(EVENT);
      expect(content.createAiDraft).not.toHaveBeenCalled();
    });

    it('bez proizvoda u M2 — preskače', async () => {
      const { svc, content } = make();
      await svc.handleOfferExpiring({ ...EVENT, product_id: null });
      expect(content.createAiDraft).not.toHaveBeenCalled();
    });

    it('registruje se na M3 pricelist.offer.expiring', () => {
      const { svc, listener } = make();
      svc.onModuleInit();
      expect(listener.on).toHaveBeenCalledWith(
        'M3',
        'pricelist.offer.expiring',
        expect.any(Function),
      );
    });
  });

  describe('publish — istekla akcija (§3d)', () => {
    function make(content: Record<string, unknown>) {
      const prisma: any = {
        contentPiece: {
          findUnique: jest.fn().mockResolvedValue(content),
          update: jest.fn().mockImplementation(({ data }: any) => ({ ...content, ...data })),
        },
      };
      const auditLog = { write: jest.fn() };
      const distribution = { publish: jest.fn() };
      const service = new ContentService(prisma, auditLog as any, distribution as any);
      return { service, prisma, auditLog, distribution };
    }

    it('APPROVED sa offer_booking_to u prošlosti → EXPIRED, nijedan adapter nije pozvan, razlog u audit logu', async () => {
      const { service, distribution, auditLog, prisma } = make({
        id: 'cp1',
        status: 'APPROVED',
        offerBookingTo: new Date('2026-01-01'),
        translations: [],
      });
      const r = await service.publish('cp1');
      expect(r.status).toBe('EXPIRED');
      expect(distribution.publish).not.toHaveBeenCalled();
      expect(prisma.contentPiece.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'EXPIRED' } }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'content.expired' }),
      );
    });

    it('APPROVED sa rokom u budućnosti → objava ide normalno', async () => {
      const { service, distribution } = make({
        id: 'cp1',
        status: 'APPROVED',
        offerBookingTo: new Date('2999-01-01'),
        translations: [],
        targetChannels: [],
      });
      const r = await service.publish('cp1');
      expect(distribution.publish).toHaveBeenCalledTimes(1);
      expect(r.status).toBe('PUBLISHED');
    });
  });

  describe('B2B_SUBAGENTS ograda nad tekstom (M7 §5b.3)', () => {
    const adapter = new B2bSubagentsAdapter();
    adapter.forbiddenSupplierNames = ['Hotel Splendid d.o.o.', 'Aycon Travel'];
    const piece = (body: string) =>
      ({
        contentPieceId: 'cp1',
        type: 'SOCIAL_POST',
        title: 'Rani buking −15 %',
        body,
        languageCode: 'sr',
        trackingCode: 'ABC',
        slug: null,
        linkUrl: null,
        containsAiGeneratedMedia: false,
      }) as const;

    it('čist tekst prolazi', () => {
      expect(adapter.forbiddenContentReason(piece('Rezervacije do 30.9.2026.'))).toBeNull();
    });
    it('ime dobavljača se odbija (bez obzira na velika/mala slova)', () => {
      expect(adapter.forbiddenContentReason(piece('Ugovor sa aycon travel …'))).toMatch(
        /ime dobavljača/,
      );
    });
    it('nabavna cena se odbija', () => {
      expect(adapter.forbiddenContentReason(piece('Nabavna cena je 80 EUR'))).toMatch(/nabavnu/);
    });
    it('broj jedinica se odbija', () => {
      expect(adapter.forbiddenContentReason(piece('Imamo još 4 sobe!'))).toMatch(/jedinica/);
    });
  });
});
