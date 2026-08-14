// Minimalna in-memory zamena za expo-sqlite u testovima — pokriva samo tabele/upite koje
// src/lib/sqlite.ts stvarno koristi (itinerary_cache, check_in_queue, incident_note_queue).
// Ne simulira pravi SQL parser, samo prepoznaje tačne upite iz sqlite.ts po tabeli.

interface Row {
  [key: string]: unknown;
}

class FakeDatabase {
  private tables: Record<string, Row[]> = {
    itinerary_cache: [],
    check_in_queue: [],
    incident_note_queue: [],
  };

  async execAsync(): Promise<void> {
    // CREATE TABLE IF NOT EXISTS — no-op, tabele već postoje u ovom fake-u.
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    await fn();
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    const table = tableFromSql(sql);
    if (sql.startsWith('DELETE FROM')) {
      this.tables[table] = [];
      return;
    }
    if (sql.startsWith('INSERT INTO itinerary_cache')) {
      const [bookingItemId, data, cachedAt] = params;
      this.tables.itinerary_cache.push({ booking_item_id: bookingItemId, data, cached_at: cachedAt });
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO check_in_queue')) {
      const [id, bookingItemGuestId, checkedInAt] = params;
      this.tables.check_in_queue = this.tables.check_in_queue.filter((r) => r.id !== id);
      this.tables.check_in_queue.push({ id, booking_item_guest_id: bookingItemGuestId, checked_in_at: checkedInAt });
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO incident_note_queue')) {
      const [id, bookingId, note, severity, createdAt] = params;
      this.tables.incident_note_queue = this.tables.incident_note_queue.filter((r) => r.id !== id);
      this.tables.incident_note_queue.push({ id, booking_id: bookingId, note, severity, created_at: createdAt });
      return;
    }
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    const table = tableFromSql(sql);
    return this.tables[table] as unknown as T[];
  }
}

function tableFromSql(sql: string): string {
  if (sql.includes('itinerary_cache')) return 'itinerary_cache';
  if (sql.includes('check_in_queue')) return 'check_in_queue';
  if (sql.includes('incident_note_queue')) return 'incident_note_queue';
  throw new Error(`Nepoznata tabela u upitu: ${sql}`);
}

const singleton = new FakeDatabase();

export async function openDatabaseAsync(): Promise<FakeDatabase> {
  return singleton;
}
