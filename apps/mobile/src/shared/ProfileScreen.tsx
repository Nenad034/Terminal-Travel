import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { logout } from '../lib/auth';
import { getSession } from '../lib/session';

// Zajednički za oba stek-a (gost i vodič) — samo odjava, spec §2/§4 ne traže ništa dodatno
// od profila u ovom prolazu. Dopuna (2.9.2026, M9 spec §2a) — link ka "Putni profil" je
// GOST-only (vodič nema GuestProfile), zato uslovljen ulogom iz sesije.
export function ProfileScreen() {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    getSession().then((s) => setIsGuest(s?.role === 'GOST'));
  }, []);

  return (
    <View style={styles.container}>
      {isGuest && (
        <Pressable style={styles.linkButton} onPress={() => router.push('/(guest)/putni-profil')}>
          <Text style={styles.linkButtonText}>Putni profil</Text>
        </Pressable>
      )}
      <Pressable
        style={styles.button}
        onPress={async () => {
          await logout();
          router.replace('/prijava');
        }}
      >
        <Text style={styles.buttonText}>Odjavi se</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', gap: 12 },
  linkButton: { backgroundColor: '#f2f2f2', borderRadius: 8, padding: 14, alignItems: 'center' },
  linkButtonText: { color: '#1a4d8f', fontWeight: '600' },
  button: { backgroundColor: '#b00020', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
