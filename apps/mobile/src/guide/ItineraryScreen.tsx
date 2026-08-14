import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { getCachedItinerary, type ItineraryItem } from '../lib/sqlite';
import { refreshItinerary } from '../lib/sync';
import { useNetworkStatus } from '../shared/NetworkStatusProvider';
import { useScreenSize } from '../shared/responsive';
import { SyncStatusBanner } from './SyncStatusBanner';

// M9 spec §3.1/§3.2 v1.4 — "vodič bez signala može da vidi itinerar ... preuzete pre gubitka
// signala": ekran prvo prikazuje ono što je u lokalnom SQLite kešu (odmah, i bez mreže), pa u
// pozadini pokušava osvežavanje sa servera (14 dana unapred, spec §3.2 predlog).
const WINDOW_DAYS = 14;

export function ItineraryScreen() {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { isConnected } = useNetworkStatus();
  const screenSize = useScreenSize();

  async function loadFromCache() {
    setItems(await getCachedItinerary());
  }

  async function loadFromNetwork() {
    if (!isConnected) return;
    setRefreshing(true);
    try {
      const from = new Date();
      const to = new Date(Date.now() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const fresh = await refreshItinerary(from.toISOString(), to.toISOString());
      setItems(fresh);
    } catch {
      // Bez signala ili API greška — ostaje ono što je već u kešu, ne brisati prikaz.
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadFromCache().then(loadFromNetwork);
  }, []);

  return (
    <View style={styles.container}>
      <SyncStatusBanner />
      <FlatList
        key={screenSize}
        data={items}
        numColumns={screenSize === 'wide' ? 2 : 1}
        keyExtractor={(item) => item.bookingItemId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadFromNetwork} />}
        ListEmptyComponent={<Text style={styles.empty}>Nema dodeljenih tura u narednih {WINDOW_DAYS} dana.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, screenSize === 'wide' && styles.cardWide]}
            onPress={() => router.push(`/(guide)/tura/${item.bookingItemId}`)}
          >
            <Text style={styles.cardTitle}>
              {item.destinationCity}, {item.destinationCountry}
            </Text>
            <Text style={styles.cardSubtitle}>Rezervacija {item.bookingNumber}</Text>
            <Text style={styles.cardDates}>
              {new Date(item.stayFrom).toLocaleDateString()} – {new Date(item.stayTo).toLocaleDateString()}
            </Text>
            <Text style={styles.cardGuests}>{item.guests.length} gost(a)</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, gap: 12 },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
  card: { flex: 1, backgroundColor: '#f2f2f2', borderRadius: 12, padding: 16, margin: 6 },
  cardWide: { maxWidth: '48%' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardSubtitle: { color: '#555', marginTop: 4 },
  cardDates: { marginTop: 8 },
  cardGuests: { marginTop: 4, color: '#555' },
});
