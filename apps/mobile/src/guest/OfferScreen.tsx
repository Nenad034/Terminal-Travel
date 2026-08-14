import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { formatPrice } from '../lib/types';

interface OfferParams extends Record<string, string> {
  productId: string;
  name: string;
  stayFrom: string;
  stayTo: string;
  adults: string;
  children: string;
  finalPrice: string;
  finalPriceCurrency: string;
}

// M9 spec §2 v1.4 — mirror apps/web/.../rezervacija/ponuda/page.tsx: pregled PRE kreiranja
// M5 Quote zapisa (Quote se pravi tek na koraku prihvatanja uslova, isti razlog kao M8).
export function OfferScreen(params: OfferParams) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pregled ponude</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{params.name}</Text>
        <Text style={styles.detail}>
          {params.stayFrom} → {params.stayTo}
        </Text>
        <Text style={styles.detail}>
          {params.adults} odraslih, {params.children} dece
        </Text>
        {params.finalPrice ? <Text style={styles.price}>{formatPrice(Number(params.finalPrice), params.finalPriceCurrency)}</Text> : null}
      </View>
      <Pressable
        style={styles.button}
        onPress={() => router.push({ pathname: '/(guest)/podaci-gosta', params })}
      >
        <Text style={styles.buttonText}>Nastavi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  card: { backgroundColor: '#f2f2f2', borderRadius: 12, padding: 16, gap: 6 },
  name: { fontSize: 18, fontWeight: '600' },
  detail: { color: '#555' },
  price: { marginTop: 8, fontSize: 18, fontWeight: '700', color: '#1a4d8f' },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
