import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api-client';
import type { Booking } from '../lib/types';

export function ConfirmationScreen({ bookingId, nacin }: { bookingId: string; nacin?: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Booking>(`/sales/bookings/${bookingId}`)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rezervacija je potvrđena</Text>
      {booking && (
        <>
          <Text style={styles.number}>Broj rezervacije: {booking.bookingNumber}</Text>
          {nacin === 'bank' && <Text style={styles.hint}>Uputstva za uplatu su poslata na email.</Text>}
          <Pressable style={styles.button} onPress={() => router.push({ pathname: '/(guest)/vaucer/[bookingId]', params: { bookingId } })}>
            <Text style={styles.buttonText}>Prikaži vaučer</Text>
          </Pressable>
        </>
      )}
      <Pressable style={styles.buttonOutline} onPress={() => router.replace('/(guest)/pretraga')}>
        <Text style={styles.buttonOutlineText}>Nazad na pretragu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1a4d8f', textAlign: 'center' },
  number: { fontSize: 16 },
  hint: { color: '#666', textAlign: 'center' },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center', width: '100%', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
  buttonOutline: { borderWidth: 1, borderColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center', width: '100%' },
  buttonOutlineText: { color: '#1a4d8f', fontWeight: '600' },
});
