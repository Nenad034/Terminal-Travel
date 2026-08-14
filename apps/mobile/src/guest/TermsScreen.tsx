import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api-client';
import type { Quote } from '../lib/types';

interface Params {
  productId: string;
  stayFrom: string;
  stayTo: string;
  adults: string;
  children: string;
  buyerName: string;
}

// M9 spec §2 v1.4 — mirror apps/web/.../rezervacija/uslovi/page.tsx + rezervacija/actions.ts
// acceptTermsAndCreateQuoteAction: clickwrap kreira M5 Quote sa contract_terms_accepted=true,
// channel MOBILE (isti razlog kao M8 zašto se Quote pravi tek ovde, ne na koraku pregleda).
export function TermsScreen(params: Params) {
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!accepted) return;
    setPending(true);
    setError(null);
    try {
      const quote = await apiFetch<Quote>('/sales/quotes', {
        method: 'POST',
        body: {
          channel: 'MOBILE',
          contractTermsAccepted: true,
          items: [
            {
              productId: params.productId,
              stayFrom: params.stayFrom,
              stayTo: params.stayTo,
              occupancy: { adults: Number(params.adults) || 2, children: Number(params.children) || 0 },
            },
          ],
        },
      });
      router.push({ pathname: '/(guest)/placanje', params: { quoteId: quote.id, buyerName: params.buyerName } });
    } catch {
      setError('Ponuda nije mogla da se kreira (cena je možda istekla) — pokušajte pretragu ponovo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Uslovi putovanja</Text>
      <ScrollView style={styles.termsBox}>
        <Text style={styles.termsText}>
          Ugovor o organizovanju putovanja/posredovanju sastavlja se automatski po potvrdi rezervacije i sadrži: podatke agencije,
          cenu, itinerar, uslove otkazivanja, garanciju putovanja i dinamiku plaćanja. Pun tekst dobijate uz potvrdu rezervacije.
        </Text>
      </ScrollView>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.checkboxRow} onPress={() => setAccepted((v) => !v)}>
        <View style={[styles.checkbox, accepted && styles.checkboxChecked]} />
        <Text style={styles.checkboxLabel}>Prihvatam uslove putovanja.</Text>
      </Pressable>
      <Pressable style={[styles.button, !accepted && styles.buttonDisabled]} disabled={!accepted || pending} onPress={submit}>
        {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Prihvatam i nastavljam</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  termsBox: { maxHeight: 200, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  termsText: { color: '#555' },
  error: { color: '#b00020' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: '#999', borderRadius: 4 },
  checkboxChecked: { backgroundColor: '#1a4d8f', borderColor: '#1a4d8f' },
  checkboxLabel: { flex: 1 },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
