import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api-client';

interface Params {
  quoteId: string;
  buyerName: string;
}

// M9 spec §2 v1.4 — mirror apps/web/.../rezervacija/actions.ts payByBankTransferAction /
// payByCardAction. M10 platni provajder još nije izabran (spec §12) — mock gateway, isti
// initiate→webhook poziv koji bi u produkciji stigao od pravog provajdera.
export function PaymentScreen({ quoteId, buyerName }: Params) {
  const [pending, setPending] = useState<'card' | 'bank' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function payByBankTransfer() {
    setPending('bank');
    setError(null);
    try {
      const booking = await apiFetch<{ id: string }>(`/sales/quotes/${quoteId}/confirm`, {
        method: 'POST',
        body: { buyerName, buyerType: 'FIZICKO_LICE' },
      });
      router.replace({ pathname: '/(guest)/potvrda', params: { bookingId: booking.id, nacin: 'bank' } });
    } catch {
      setError('Plaćanje nije uspelo, pokušajte ponovo.');
    } finally {
      setPending(null);
    }
  }

  async function payByCard() {
    setPending('card');
    setError(null);
    try {
      const initiated = await apiFetch<{ gatewayTransactionId: string }>('/finance/payments/card/initiate', {
        method: 'POST',
        body: { quoteId, idempotencyKey: `${quoteId}-card` },
        auth: false,
      });
      const booking = await apiFetch<{ bookingId: string }>('/finance/payments/card/webhook', {
        method: 'POST',
        body: { gatewayTransactionId: initiated.gatewayTransactionId, buyerName, buyerType: 'FIZICKO_LICE' },
        auth: false,
      });
      router.replace({ pathname: '/(guest)/potvrda', params: { bookingId: booking.bookingId, nacin: 'card' } });
    } catch {
      setError('Plaćanje nije uspelo, pokušajte ponovo.');
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plaćanje</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={payByCard} disabled={pending !== null}>
        {pending === 'card' ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Plaćanje karticom</Text>}
      </Pressable>
      <Pressable style={styles.buttonOutline} onPress={payByBankTransfer} disabled={pending !== null}>
        {pending === 'bank' ? <ActivityIndicator color="#1a4d8f" /> : <Text style={styles.buttonOutlineText}>Uplata na račun</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  error: { color: '#b00020' },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  buttonOutline: { borderWidth: 1, borderColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonOutlineText: { color: '#1a4d8f', fontWeight: '600' },
});
