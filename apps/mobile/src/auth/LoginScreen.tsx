import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { login, verifyMfa } from '../lib/auth';
import { getSession } from '../lib/session';
import { registerForPushNotifications } from '../shared/PushNotifications';

// M9 v1.4 — dvokoraka prijava, ista logika kao apps/panel/src/app/prijava/LoginForm.tsx
// (state 'credentials' | 'mfa', mfaToken se prenosi između koraka). MFA je obavezna za
// VODIC, opciona za GOST (M1 spec §5) — ovaj ekran ne mora unapred da zna koju ulogu prijavljuje,
// server odlučuje da li traži drugi korak.
export function LoginScreen({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function finish() {
    const session = await getSession();
    await registerForPushNotifications();
    onSuccess(session?.role ?? 'GOST');
  }

  async function onCredentialsSubmit() {
    setPending(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.requiresMfa) {
        setMfaToken(result.mfaToken);
        setStep('mfa');
      } else {
        await finish();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prijava nije uspela.');
    } finally {
      setPending(false);
    }
  }

  async function onMfaSubmit() {
    setPending(true);
    setError(null);
    try {
      await verifyMfa(mfaToken, code);
      await finish();
    } catch {
      setError('Neispravan MFA kod.');
    } finally {
      setPending(false);
    }
  }

  if (step === 'mfa') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Dvofaktorska potvrda</Text>
        <Text style={styles.hint}>6-cifreni kod iz autentifikator aplikacije.</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          autoFocus
        />
        <Pressable style={styles.button} onPress={onMfaSubmit} disabled={pending}>
          {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Potvrdi</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Terminal Travel</Text>
      <Text style={styles.hint}>Prijavite se svojim nalogom.</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoFocus
      />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="lozinka" secureTextEntry />
      <Pressable style={styles.button} onPress={onCredentialsSubmit} disabled={pending}>
        {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Prijavi se</Text>}
      </Pressable>
      <Pressable onPress={() => router.push('/registracija')}>
        <Text style={styles.link}>Nemate nalog? Registrujte se</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  hint: { color: '#666', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#b00020' },
  link: { textAlign: 'center', color: '#1a4d8f', marginTop: 12 },
});
