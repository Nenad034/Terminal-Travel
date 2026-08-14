import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { apiFetch, ApiError } from '../lib/api-client';

// M1 spec §5 — POST /iam/auth/register, isti kao apps/web RegisterForm.tsx. Nalog se pravi
// bez lozinke prijave odmah nakon — korisnik se posle registracije prijavljuje preko
// LoginScreen (isti obrazac kao M8).
export function RegisterScreen({ onRegistered }: { onRegistered: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await apiFetch('/iam/auth/register', {
        method: 'POST',
        body: { email: email.trim(), password, fullName: fullName.trim(), phone: phone.trim() || undefined },
        auth: false,
      });
      onRegistered();
    } catch (err) {
      setError(err instanceof ApiError ? ((err.body as { message?: string })?.message ?? 'Registracija nije uspela.') : 'Registracija nije uspela.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Novi nalog</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="ime i prezime" autoFocus />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email" autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="telefon (opciono)" keyboardType="phone-pad" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="lozinka (min. 12 karaktera)" secureTextEntry />
      <Pressable style={styles.button} onPress={submit} disabled={pending}>
        {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registruj se</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#b00020' },
});
