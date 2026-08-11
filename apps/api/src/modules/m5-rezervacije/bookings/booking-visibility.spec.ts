import { serializeBooking, serializeBookingItem, RawBookingItem } from './booking-visibility';

describe('booking-visibility (M5 spec §6.2)', () => {
  function makeItem(): RawBookingItem {
    return {
      id: 'item-1',
      bookingId: 'booking-1',
      productId: 'product-1',
      sourceType: 'CONTRACTED',
      supplierReference: 'contract-period-secret-id',
      stayFrom: new Date('2027-01-10'),
      stayTo: new Date('2027-01-15'),
      baseCost: 10000,
      baseCostCurrency: 'EUR',
      rateLineId: 'rate-line-1',
      markupRuleId: 'markup-rule-1',
      finalPrice: 12000,
      finalPriceCurrency: 'EUR',
      itemStatus: 'CONFIRMED',
      cancellationRefundPercentage: null,
      assignedGuideId: null,
      duplicateConflictItemId: null,
      duplicateCheckOverriddenBy: null,
      duplicateCheckOverriddenAt: null,
      announcedAt: null,
      supplierConfirmedAt: null,
      supplierConfirmedBy: null,
    };
  }

  it('B2C/B2B/gost kontekst NIKAD ne sadrži supplier_reference niti rate_line_id/markup_rule_id', () => {
    const item = makeItem();
    for (const context of ['B2C', 'B2B', 'MOBILE_GUEST'] as const) {
      const serialized = serializeBookingItem(item, context) as any;
      expect(serialized.supplierReference).toBeUndefined();
      expect(serialized.rateLineId).toBeUndefined();
      expect(serialized.markupRuleId).toBeUndefined();
      expect(serialized.baseCost).toBeUndefined();
      // ono što SME da se vidi ostaje prisutno.
      expect(serialized.finalPrice).toBe(12000);
      expect(serialized.itemStatus).toBe('CONFIRMED');
    }
  });

  it('INTERNAL_PANEL kontekst i dalje vraća supplier_reference u potpunosti', () => {
    const item = makeItem();
    const serialized = serializeBookingItem(item, 'INTERNAL_PANEL') as any;
    expect(serialized.supplierReference).toBe('contract-period-secret-id');
    expect(serialized.rateLineId).toBe('rate-line-1');
  });

  it('serializeBooking primenjuje isto pravilo na svaku stavku liste', () => {
    const booking = { id: 'booking-1', items: [makeItem(), makeItem()] };
    const serialized = serializeBooking(booking, 'B2C') as any;
    expect(serialized.items).toHaveLength(2);
    for (const item of serialized.items) {
      expect(item.supplierReference).toBeUndefined();
    }
  });
});
