import {
  replaceItineraryCache,
  getCachedItinerary,
  enqueueCheckIn,
  enqueueIncidentNote,
  getQueueSize,
  clearQueue,
  type ItineraryItem,
} from '../src/lib/sqlite';

// M9 spec §3.1/§3.2 — vodič vidi itinerar preuzet pre gubitka signala (kešuje se lokalno) i
// radnje urađene bez signala se ne gube pre sync-a. Ovde testiramo samo lokalni SQLite sloj
// (mock u __mocks__/expo-sqlite.ts) — sam POST /mobile/staff/sync je već pokriven backend
// e2e testom (apps/api/test/m9-exit-criteria.e2e-spec.ts).

const sampleItem: ItineraryItem = {
  bookingItemId: 'bi-1',
  bookingId: 'booking-1',
  bookingNumber: 'TT-2027-000001',
  productId: 'prod-1',
  destinationCountry: 'Grčka',
  destinationCity: 'Halkidiki',
  stayFrom: '2027-06-10',
  stayTo: '2027-06-14',
  itemStatus: 'CONFIRMED',
  voucherUrl: null,
  guests: [{ bookingItemGuestId: 'g-1', firstName: 'Petar', lastName: 'Petrović', email: null, phone: null, preferences: null }],
};

describe('itinerary cache', () => {
  it('čuva i vraća poslednji preuzet itinerar (dostupan bez signala)', async () => {
    await replaceItineraryCache([sampleItem]);
    const cached = await getCachedItinerary();
    expect(cached).toHaveLength(1);
    expect(cached[0].bookingItemId).toBe('bi-1');
    expect(cached[0].guests[0].firstName).toBe('Petar');
  });

  it('novo osvežavanje zamenjuje stari keš, ne dodaje na njega', async () => {
    await replaceItineraryCache([sampleItem]);
    await replaceItineraryCache([{ ...sampleItem, bookingItemId: 'bi-2' }]);
    const cached = await getCachedItinerary();
    expect(cached).toHaveLength(1);
    expect(cached[0].bookingItemId).toBe('bi-2');
  });
});

describe('sync red čekanja (offline check-in/beleška)', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it('enkjuovan check-in i beleška se broje u redu čekanja', async () => {
    await enqueueCheckIn({ id: 'ci-1', bookingItemGuestId: 'g-1', checkedInAt: new Date().toISOString() });
    await enqueueIncidentNote({ id: 'note-1', bookingId: 'booking-1', note: 'test', severity: 'URGENT', createdAt: new Date().toISOString() });
    expect(await getQueueSize()).toBe(2);
  });

  it('ponovljen isti klijentski id (idempotency key) ne duplira lokalni zapis', async () => {
    await enqueueCheckIn({ id: 'ci-1', bookingItemGuestId: 'g-1', checkedInAt: '2027-01-01T10:00:00.000Z' });
    await enqueueCheckIn({ id: 'ci-1', bookingItemGuestId: 'g-1', checkedInAt: '2027-01-01T10:05:00.000Z' });
    expect(await getQueueSize()).toBe(1);
  });

  it('praznjenje reda posle uspešnog sync-a briše sve stavke', async () => {
    await enqueueCheckIn({ id: 'ci-1', bookingItemGuestId: 'g-1', checkedInAt: new Date().toISOString() });
    await clearQueue();
    expect(await getQueueSize()).toBe(0);
  });
});
