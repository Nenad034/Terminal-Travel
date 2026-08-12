import { buildContentSnapshot, determineContractType, BookingForContract, AgencyStaticInfo } from './contract-content-builder';

describe('contract-content-builder (M20 spec §2.2/§2.3)', () => {
  const agency: AgencyStaticInfo = {
    agencyName: 'Terminal Travel',
    agencyAddress: 'Adresa 1',
    agencyLicenseNumber: 'OTP-1',
    emergencyContact: '+381600000000',
    priceChangeComplaintDeadlineDays: 8,
  };

  function makeItem(overrides: Partial<BookingForContract['items'][0]> = {}): BookingForContract['items'][0] {
    return {
      id: 'item-1',
      itemStatus: 'CONFIRMED',
      stayFrom: new Date('2027-06-10'),
      stayTo: new Date('2027-06-17'),
      cancellationPolicySnapshot: null,
      product: { type: 'ACCOMMODATION', attributes: { stars: 4 }, translations: [{ languageCode: 'sr', name: 'Hotel Test' }] },
      rateLine: { boardType: 'HALF_BOARD', contractPeriod: { cancellationRules: [{ daysBeforeStay: 30, refundPercentage: 100 }] } },
      ...overrides,
    };
  }

  describe('determineContractType (§2.2)', () => {
    it('POSREDNIK uvek daje POSREDOVANJE, bez obzira na tip proizvoda', () => {
      const booking: BookingForContract = { id: 'b1', tipNastupanja: 'POSREDNIK', totalPrice: 1000, currency: 'EUR', items: [makeItem()] };
      expect(determineContractType(booking)).toBe('POSREDOVANJE');
    });

    it('ORGANIZATOR sa PACKAGE stavkom daje ORGANIZOVANO_PUTOVANJE', () => {
      const booking: BookingForContract = {
        id: 'b1',
        tipNastupanja: 'ORGANIZATOR',
        totalPrice: 1000,
        currency: 'EUR',
        items: [makeItem({ product: { type: 'PACKAGE', attributes: {}, translations: [] } })],
      };
      expect(determineContractType(booking)).toBe('ORGANIZOVANO_PUTOVANJE');
    });

    it('ORGANIZATOR sa isključivo FLIGHT stavkama daje PRODAJA_AVIO_KARTE', () => {
      const booking: BookingForContract = {
        id: 'b1',
        tipNastupanja: 'ORGANIZATOR',
        totalPrice: 1000,
        currency: 'EUR',
        items: [makeItem({ product: { type: 'FLIGHT', attributes: {}, translations: [] } })],
      };
      expect(determineContractType(booking)).toBe('PRODAJA_AVIO_KARTE');
    });

    it('ORGANIZATOR sa isključivo TRANSFER stavkama daje TRANSFER', () => {
      const booking: BookingForContract = {
        id: 'b1',
        tipNastupanja: 'ORGANIZATOR',
        totalPrice: 1000,
        currency: 'EUR',
        items: [makeItem({ product: { type: 'TRANSFER', attributes: {}, translations: [] } })],
      };
      expect(determineContractType(booking)).toBe('TRANSFER');
    });

    it('samo-INSURANCE rezervacija vraća null (van obima automatskog generisanja, §8)', () => {
      const booking: BookingForContract = {
        id: 'b1',
        tipNastupanja: 'ORGANIZATOR',
        totalPrice: 1000,
        currency: 'EUR',
        items: [makeItem({ product: { type: 'INSURANCE', attributes: {}, translations: [] } })],
      };
      expect(determineContractType(booking)).toBeNull();
    });

    it('mešovita korpa (PACKAGE + FLIGHT) daje ORGANIZOVANO_PUTOVANJE — organizacija putovanja pobeđuje', () => {
      const booking: BookingForContract = {
        id: 'b1',
        tipNastupanja: 'ORGANIZATOR',
        totalPrice: 1000,
        currency: 'EUR',
        items: [
          makeItem({ product: { type: 'PACKAGE', attributes: {}, translations: [] } }),
          makeItem({ id: 'item-2', product: { type: 'FLIGHT', attributes: {}, translations: [] } }),
        ],
      };
      expect(determineContractType(booking)).toBe('ORGANIZOVANO_PUTOVANJE');
    });
  });

  describe('buildContentSnapshot (§2.3)', () => {
    it('izostavlja itinerary kad nema PACKAGE/EXCURSION stavki (čist ACCOMMODATION)', () => {
      const booking: BookingForContract = { id: 'b1', tipNastupanja: 'ORGANIZATOR', totalPrice: 1000, currency: 'EUR', items: [makeItem()] };
      const snapshot = buildContentSnapshot({ booking, contractType: 'ORGANIZOVANO_PUTOVANJE', travelGuarantee: null, paymentSchedule: null, agency });
      expect(snapshot.itinerary).toBeNull();
      expect((snapshot.accommodation as any[])[0]).toMatchObject({ productName: 'Hotel Test', stars: 4, boardType: 'HALF_BOARD' });
    });

    it('uključuje garanciju putovanja samo za ORGANIZOVANO_PUTOVANJE', () => {
      const booking: BookingForContract = { id: 'b1', tipNastupanja: 'ORGANIZATOR', totalPrice: 1000, currency: 'EUR', items: [makeItem()] };
      const snapshot = buildContentSnapshot({
        booking,
        contractType: 'ORGANIZOVANO_PUTOVANJE',
        travelGuarantee: { provider: 'YUTA', policyNumber: 'P-1' },
        paymentSchedule: null,
        agency,
      });
      expect(snapshot.travelGuarantee).toEqual({ provider: 'YUTA', policyNumber: 'P-1' });
    });

    it('ne uključuje garanciju putovanja za POSREDOVANJE', () => {
      const booking: BookingForContract = { id: 'b1', tipNastupanja: 'POSREDNIK', totalPrice: 1000, currency: 'EUR', items: [makeItem()] };
      const snapshot = buildContentSnapshot({
        booking,
        contractType: 'POSREDOVANJE',
        travelGuarantee: { provider: 'YUTA', policyNumber: 'P-1' },
        paymentSchedule: null,
        agency,
      });
      expect(snapshot.travelGuarantee).toBeNull();
    });

    it('koristi cancellationPolicySnapshot za API stavke bez rateLine', () => {
      const booking: BookingForContract = {
        id: 'b1',
        tipNastupanja: 'ORGANIZATOR',
        totalPrice: 1000,
        currency: 'EUR',
        items: [makeItem({ rateLine: null, cancellationPolicySnapshot: { tiers: [{ daysBeforeStay: 10, refundPercentage: 50 }] } })],
      };
      const snapshot = buildContentSnapshot({ booking, contractType: 'ORGANIZOVANO_PUTOVANJE', travelGuarantee: null, paymentSchedule: null, agency });
      expect((snapshot.cancellationTerms as any[])[0].rules).toEqual({ tiers: [{ daysBeforeStay: 10, refundPercentage: 50 }] });
    });
  });
});
