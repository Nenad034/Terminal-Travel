import * as SQLite from 'expo-sqlite';

// M9 spec §3.1/§3.2 v1.4 — lokalna baza vodiča: `itinerary_cache` (poslednji uspešan
// `GET /mobile/staff/my-itinerary` odgovor, čita se bez signala) i `sync_queue`
// (FieldCheckIn/FieldIncidentNote napravljeni bez signala, čekaju POST /mobile/staff/sync).
// Sinhronizacija je idempotentna po klijentski generisanom `id` (field-staff.service.ts),
// pa je bezbedno posle uspešnog sync-a jednostavno isprazniti red — ponovni pokušaj istog
// reda (npr. ako veza padne usred slanja) samo potvrđuje već primljene zapise, ne duplira.

export interface ItineraryItem {
  bookingItemId: string;
  bookingId: string;
  bookingNumber: string;
  productId: string;
  destinationCountry: string;
  destinationCity: string;
  stayFrom: string;
  stayTo: string;
  itemStatus: string;
  voucherUrl: string | null;
  guests: Array<{
    bookingItemGuestId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    preferences: unknown;
  }>;
}

export interface QueuedCheckIn {
  id: string;
  bookingItemGuestId: string;
  checkedInAt: string;
}

export interface QueuedIncidentNote {
  id: string;
  bookingId: string;
  note: string;
  severity: 'INFO' | 'WARNING' | 'URGENT';
  createdAt: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('tt_field_staff.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS itinerary_cache (
          booking_item_id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          cached_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS check_in_queue (
          id TEXT PRIMARY KEY NOT NULL,
          booking_item_guest_id TEXT NOT NULL,
          checked_in_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS incident_note_queue (
          id TEXT PRIMARY KEY NOT NULL,
          booking_id TEXT NOT NULL,
          note TEXT NOT NULL,
          severity TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function replaceItineraryCache(items: ItineraryItem[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM itinerary_cache');
    const now = new Date().toISOString();
    for (const item of items) {
      await db.runAsync(
        'INSERT INTO itinerary_cache (booking_item_id, data, cached_at) VALUES (?, ?, ?)',
        item.bookingItemId,
        JSON.stringify(item),
        now,
      );
    }
  });
}

export async function getCachedItinerary(): Promise<ItineraryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM itinerary_cache ORDER BY booking_item_id');
  return rows.map((r) => JSON.parse(r.data) as ItineraryItem);
}

export async function enqueueCheckIn(entry: QueuedCheckIn): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO check_in_queue (id, booking_item_guest_id, checked_in_at) VALUES (?, ?, ?)',
    entry.id,
    entry.bookingItemGuestId,
    entry.checkedInAt,
  );
}

export async function enqueueIncidentNote(entry: QueuedIncidentNote): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO incident_note_queue (id, booking_id, note, severity, created_at) VALUES (?, ?, ?, ?, ?)',
    entry.id,
    entry.bookingId,
    entry.note,
    entry.severity,
    entry.createdAt,
  );
}

export async function getQueuedCheckIns(): Promise<QueuedCheckIn[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; booking_item_guest_id: string; checked_in_at: string }>(
    'SELECT * FROM check_in_queue',
  );
  return rows.map((r) => ({ id: r.id, bookingItemGuestId: r.booking_item_guest_id, checkedInAt: r.checked_in_at }));
}

export async function getQueuedIncidentNotes(): Promise<QueuedIncidentNote[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; booking_id: string; note: string; severity: string; created_at: string }>(
    'SELECT * FROM incident_note_queue',
  );
  return rows.map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    note: r.note,
    severity: r.severity as QueuedIncidentNote['severity'],
    createdAt: r.created_at,
  }));
}

export async function getQueueSize(): Promise<number> {
  const [checkIns, notes] = await Promise.all([getQueuedCheckIns(), getQueuedIncidentNotes()]);
  return checkIns.length + notes.length;
}

export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM check_in_queue');
    await db.runAsync('DELETE FROM incident_note_queue');
  });
}
