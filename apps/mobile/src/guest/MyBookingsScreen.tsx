import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api-client';
import type { Booking } from '../lib/types';

// M9 spec §2 v1.4 — mirror apps/web/.../nalog/moje-rezervacije/page.tsx (GET /sales/bookings,
// ownership sprovodi BookingsService, isti odgovor za GOST kanal).
export function MyBookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      setBookings(await apiFetch<Booking[]>('/sales/bookings'));
    } catch {
      setBookings([]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <FlatList
      data={bookings}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      ListEmptyComponent={<Text style={styles.empty}>Nemate rezervacija.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push({ pathname: '/(guest)/vaucer/[bookingId]', params: { bookingId: item.id } })}>
          <Text style={styles.number}>{item.bookingNumber}</Text>
          <Text style={styles.status}>
            {item.status} — {item.paymentStatus}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', marginTop: 24, color: '#666' },
  card: { backgroundColor: '#f2f2f2', borderRadius: 12, padding: 16 },
  number: { fontSize: 16, fontWeight: '700' },
  status: { color: '#555', marginTop: 4 },
});
