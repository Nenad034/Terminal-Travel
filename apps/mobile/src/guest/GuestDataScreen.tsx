import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getSession } from '../lib/session';

interface Params {
  productId: string;
  name: string;
  stayFrom: string;
  stayTo: string;
  adults: string;
  children: string;
  finalPrice: string;
  finalPriceCurrency: string;
}

// M9 spec §2 v1.4 — mirror apps/web/.../rezervacija/podaci-gosta/page.tsx: nalog je već
// preduslov (registracija pre rezervacije, isto kao M8), ovaj korak traži samo ime za
// ugovor/vaučer (M5 ConfirmQuoteDto.buyerName).
export function GuestDataScreen(params: Params) {
  const [buyerName, setBuyerName] = useState('');
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    getSession().then((s) => setHasSession(Boolean(s)));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Podaci putnika</Text>
      {hasSession === false && (
        <Text style={styles.notice}>
          Morate biti prijavljeni da biste nastavili. <Text style={styles.link} onPress={() => router.push('/prijava')}>Prijavite se</Text>
        </Text>
      )}
      <TextInput style={styles.input} value={buyerName} onChangeText={setBuyerName} placeholder="Ime i prezime" autoFocus />
      <Pressable
        style={[styles.button, (!buyerName || !hasSession) && styles.buttonDisabled]}
        disabled={!buyerName || !hasSession}
        onPress={() => router.push({ pathname: '/(guest)/uslovi', params: { ...params, buyerName } })}
      >
        <Text style={styles.buttonText}>Nastavi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  notice: { backgroundColor: '#fff3cd', borderRadius: 8, padding: 12 },
  link: { color: '#1a4d8f', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
