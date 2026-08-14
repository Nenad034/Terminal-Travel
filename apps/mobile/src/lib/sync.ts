import { apiFetch } from './api-client';
import { clearQueue, getQueuedCheckIns, getQueuedIncidentNotes, replaceItineraryCache, type ItineraryItem } from './sqlite';

// M9 spec §3.2 v1.4 — "čim se signal vrati, POST /mobile/staff/sync šalje ceo red čekanja
// odjednom". Poziva se iz NetworkStatusProvider (shared) čim NetInfo prijavi vezu, i ručno
// preko "sinhronizuj sada" dugmeta (SyncStatusBanner).
export async function flushSyncQueue(): Promise<void> {
  const [checkIns, incidentNotes] = await Promise.all([getQueuedCheckIns(), getQueuedIncidentNotes()]);
  if (!checkIns.length && !incidentNotes.length) return;

  await apiFetch('/mobile/staff/sync', { method: 'POST', body: { checkIns, incidentNotes } });
  // Idempotentno na serveru po `id` — bezbedno je isprazniti ceo lokalni red posle uspešnog
  // odgovora, čak i ako je deo tih zapisa server već ranije primio (§3.2 "poslednji upis pobeđuje").
  await clearQueue();
}

export async function refreshItinerary(fromISO: string, toISO: string): Promise<ItineraryItem[]> {
  const items = await apiFetch<ItineraryItem[]>(`/mobile/staff/my-itinerary?from=${fromISO}&to=${toISO}`);
  await replaceItineraryCache(items);
  return items;
}
