import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api-client';
import { formatPrice, type SearchResultProduct } from '../lib/types';
import { useScreenSize } from '../shared/responsive';

// M9 spec §2 v1.4 — isti poziv kao apps/web/src/app/[locale]/pretraga/page.tsx
// (GET /sales/search, channel MOBILE — M9 spec §7 "Ostalo (deo za goste): isti endpoint-i
// kao M8"), bez sopstvene poslovne logike.
export function SearchScreen() {
  const [destination, setDestination] = useState('');
  const [stayFrom, setStayFrom] = useState('');
  const [stayTo, setStayTo] = useState('');
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [results, setResults] = useState<SearchResultProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const screenSize = useScreenSize();

  async function search() {
    setLoading(true);
    setSearched(true);
    try {
      const occupancy = JSON.stringify({ adults: Number(adults) || 2, children: Number(children) || 0 });
      const query = new URLSearchParams({
        channel: 'MOBILE',
        occupancy,
        ...(destination ? { destinationCity: destination } : {}),
        ...(stayFrom ? { stayFrom } : {}),
        ...(stayTo ? { stayTo } : {}),
      });
      const found = await apiFetch<SearchResultProduct[]>(`/sales/search?${query.toString()}`, { auth: false });
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Destinacija (grad)" />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.flex1]} value={stayFrom} onChangeText={setStayFrom} placeholder="Od (GGGG-MM-DD)" />
          <TextInput style={[styles.input, styles.flex1]} value={stayTo} onChangeText={setStayTo} placeholder="Do (GGGG-MM-DD)" />
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.flex1]} value={adults} onChangeText={setAdults} placeholder="Odrasli" keyboardType="number-pad" />
          <TextInput style={[styles.input, styles.flex1]} value={children} onChangeText={setChildren} placeholder="Deca" keyboardType="number-pad" />
        </View>
        <Pressable style={styles.button} onPress={search} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pretraži</Text>}
        </Pressable>
      </View>

      <FlatList
        key={screenSize}
        data={results}
        numColumns={screenSize === 'wide' ? 2 : 1}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={searched && !loading ? <Text style={styles.empty}>Nema rezultata.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, screenSize === 'wide' && styles.cardWide]}
            onPress={() =>
              router.push({
                pathname: '/(guest)/ponuda',
                params: {
                  productId: item.productId,
                  name: item.translation?.name ?? item.productId,
                  stayFrom,
                  stayTo,
                  adults,
                  children,
                  finalPrice: String(item.offers[0]?.finalPrice ?? ''),
                  finalPriceCurrency: item.offers[0]?.finalPriceCurrency ?? 'EUR',
                },
              })
            }
          >
            <Text style={styles.cardTitle}>{item.translation?.name ?? item.productId}</Text>
            <Text style={styles.cardSubtitle}>{[item.destinationCity, item.destinationCountry].filter(Boolean).join(', ')}</Text>
            {item.offers[0] && <Text style={styles.cardPrice}>{formatPrice(item.offers[0].finalPrice, item.offers[0].finalPriceCurrency)}</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  list: { padding: 12, gap: 12 },
  empty: { textAlign: 'center', marginTop: 24, color: '#666' },
  card: { flex: 1, backgroundColor: '#f2f2f2', borderRadius: 12, padding: 16, margin: 6 },
  cardWide: { maxWidth: '48%' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#555', marginTop: 4 },
  cardPrice: { marginTop: 8, fontWeight: '700', color: '#1a4d8f' },
});
