import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { apiFetch } from '../lib/api-client';
import type { Booking } from '../lib/types';

// M9 spec §2 v1.4 — "prikaz vaučera sa QR kodom pogodnim za skeniranje na licu mesta":
// QR kodira Booking.voucherUrl (isti PDF link koji M5/M8 već izlaže preko voucherUrl).
export function VoucherScreen({ bookingId }: { bookingId: string }) {
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

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text>Rezervacija nije pronađena.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.number}>{booking.bookingNumber}</Text>
      {booking.voucherUrl ? (
        <>
          <QRCode value={booking.voucherUrl} size={220} />
          <Pressable onPress={() => Linking.openURL(booking.voucherUrl!)}>
            <Text style={styles.link}>Otvori vaučer (PDF)</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.pending}>Vaučer još nije izdat — dostupan je po potvrdi uplate.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  number: { fontSize: 18, fontWeight: '700' },
  link: { color: '#1a4d8f', fontWeight: '600', marginTop: 8 },
  pending: { color: '#666', textAlign: 'center' },
});
