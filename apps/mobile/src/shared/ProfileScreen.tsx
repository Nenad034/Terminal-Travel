import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { logout } from '../lib/auth';

// Zajednički za oba stek-a (gost i vodič) — samo odjava, spec §2/§4 ne traže ništa dodatno
// od profila u ovom prolazu.
export function ProfileScreen() {
  return (
    <View style={styles.container}>
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
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  button: { backgroundColor: '#b00020', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
