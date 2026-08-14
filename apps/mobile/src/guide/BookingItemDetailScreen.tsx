import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { getCachedItinerary, enqueueCheckIn, type ItineraryItem } from '../lib/sqlite';
import { flushSyncQueue } from '../lib/sync';
import { useNetworkStatus } from '../shared/NetworkStatusProvider';

// M9 spec §3.3 v1.4 — check-in po gostu. Klijentski generisan `id` (idempotency key, spec §3.2)
// se pravi ODMAH na uređaju, ne kad se sinhronizuje — omogućava rad bez signala.
export function BookingItemDetailScreen({ bookingItemId }: { bookingItemId: string }) {
  const [item, setItem] = useState<ItineraryItem | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const { isConnected, refreshQueueSize } = useNetworkStatus();

  useEffect(() => {
    getCachedItinerary().then((all) => setItem(all.find((i) => i.bookingItemId === bookingItemId) ?? null));
  }, [bookingItemId]);

  async function checkIn(bookingItemGuestId: string) {
    await enqueueCheckIn({ id: randomUUID(), bookingItemGuestId, checkedInAt: new Date().toISOString() });
    setCheckedInIds((prev) => new Set(prev).add(bookingItemGuestId));
    await refreshQueueSize();
    if (isConnected) {
      flushSyncQueue()
        .then(refreshQueueSize)
        .catch(() => {
          // Ostaje u redu, sledeći pokušaj (automatski ili ručni) ga šalje.
        });
    } else {
      Alert.alert('Sačuvano lokalno', 'Bez signala — check-in će se poslati čim se veza vrati.');
    }
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Tura nije pronađena u lokalnom kešu.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {item.destinationCity}, {item.destinationCountry}
      </Text>
      <Text style={styles.subtitle}>Rezervacija {item.bookingNumber}</Text>

      <Pressable style={styles.incidentButton} onPress={() => router.push(`/(guide)/beleska/${item.bookingId}`)}>
        <Text style={styles.incidentButtonText}>Prijavi problem na terenu</Text>
      </Pressable>

      <FlatList
        style={styles.list}
        data={item.guests}
        keyExtractor={(g) => g.bookingItemGuestId}
        renderItem={({ item: guest }) => {
          const checkedIn = checkedInIds.has(guest.bookingItemGuestId);
          return (
            <View style={styles.guestRow}>
              <View style={styles.guestInfo}>
                <Text style={styles.guestName}>
                  {guest.firstName} {guest.lastName}
                </Text>
                {guest.phone && <Text style={styles.guestMeta}>{guest.phone}</Text>}
                {guest.preferences ? <Text style={styles.guestMeta}>{JSON.stringify(guest.preferences)}</Text> : null}
              </View>
              <Pressable
                style={[styles.checkInButton, checkedIn && styles.checkInButtonDone]}
                disabled={checkedIn}
                onPress={() => checkIn(guest.bookingItemGuestId)}
              >
                <Text style={styles.checkInButtonText}>{checkedIn ? 'Prijavljen' : 'Check-in'}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#555', marginTop: 4, marginBottom: 12 },
  incidentButton: { backgroundColor: '#b00020', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 16 },
  incidentButtonText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  guestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
  guestInfo: { flex: 1 },
  guestName: { fontSize: 16, fontWeight: '600' },
  guestMeta: { color: '#666', fontSize: 12 },
  checkInButton: { backgroundColor: '#1a4d8f', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  checkInButtonDone: { backgroundColor: '#4caf50' },
  checkInButtonText: { color: '#fff', fontWeight: '600' },
});
