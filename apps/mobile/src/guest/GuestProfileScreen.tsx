import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, apiFetchMultipart, ApiError } from '../lib/api-client';
import type { GuestProfile, ScannedDocumentFields } from '../lib/types';

type DocumentType = 'PASSPORT' | 'LICNA_KARTA';

interface FormState {
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
}

const EMPTY_FORM: FormState = { fullName: '', documentType: 'PASSPORT', documentNumber: '', nationality: '', dateOfBirth: '' };

// M9 spec §2a / M15 spec §6.5.6e / M6 spec §2.2 — gost pri PRVOM kreiranju putnog profila
// bira ručan unos ili fotografisanje pasoša (skeniranje je uvek OPCIONA pogodnost, ne
// zamenjuje ručan unos — kamera koja otkaže ili nečitljiv dokument nikad ne blokira
// registraciju). Već postojeći profil se ovde samo prikazuje, izmena skeniranjem nije deo
// ovog prolaza (vlasnikova odluka, 2.9.2026 — "Prvo", tj. samo nova registracija).
export function GuestProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<GuestProfile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [scanning, setScanning] = useState(false);
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<GuestProfile[]>('/crm/guest-profiles')
      .then((profiles) => setExisting(profiles[0] ?? null))
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyScanResult(result: ScannedDocumentFields) {
    setScanWarning(result.warning ?? null);
    if (!result.documentDetected) return;
    setForm((f) => ({
      fullName: result.fullName ?? f.fullName,
      documentType: result.documentType ?? f.documentType,
      documentNumber: result.documentNumber ?? f.documentNumber,
      nationality: result.nationality ?? f.nationality,
      dateOfBirth: result.dateOfBirth ?? f.dateOfBirth,
    }));
  }

  async function scanPassport() {
    setError(null);
    setScanWarning(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Dozvola za kameru nije data — unesite podatke ručno.');
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (photo.canceled || !photo.assets?.[0]) return;

    const asset = photo.assets[0];
    const formData = new FormData();
    // RN fetch prihvata ovaj oblik direktno kao multipart deo (isti obrazac kao ostatak Expo
    // ekosistema) — polje se zove "image", isto ime koje čita `FileInterceptor` na backendu.
    formData.append('image', { uri: asset.uri, name: 'passport.jpg', type: 'image/jpeg' } as unknown as Blob);

    setScanning(true);
    try {
      const result = await apiFetchMultipart<ScannedDocumentFields>('/mobile/guest-profile/scan-document', formData);
      applyScanResult(result);
    } catch (err) {
      setError(err instanceof ApiError ? 'Skeniranje nije uspelo — unesite podatke ručno.' : 'Skeniranje nije uspelo — unesite podatke ručno.');
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      setError('Datum rođenja mora biti u formatu GGGG-MM-DD.');
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<GuestProfile>('/crm/guest-profiles', { method: 'POST', body: form });
      setExisting(created);
    } catch (err) {
      setError(err instanceof ApiError ? extractMessage(err) : 'Čuvanje profila nije uspelo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (existing) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Putni profil</Text>
        <View style={styles.card}>
          <Text style={styles.cardName}>{existing.fullName}</Text>
          <Text style={styles.cardLine}>{existing.documentType === 'PASSPORT' ? 'Pasoš' : 'Lična karta'} · {maskDocumentNumber(existing.documentNumber)}</Text>
          <Text style={styles.cardLine}>{existing.nationality} · rođ. {existing.dateOfBirth}</Text>
        </View>
      </View>
    );
  }

  const canSave = form.fullName && form.documentNumber && form.nationality && form.dateOfBirth && !saving;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Putni profil</Text>
      <Text style={styles.subtitle}>Popunite ručno ili fotografišite pasoš — polja se predpopunjuju, vi ih pregledate pre čuvanja.</Text>

      <Pressable style={[styles.scanButton, scanning && styles.buttonDisabled]} disabled={scanning} onPress={scanPassport}>
        <Text style={styles.scanButtonText}>{scanning ? 'Čitam dokument…' : '📷 Fotografiši pasoš'}</Text>
      </Pressable>
      {scanWarning && <Text style={styles.notice}>{scanWarning}</Text>}

      <TextInput style={styles.input} value={form.fullName} onChangeText={(v) => updateField('fullName', v)} placeholder="Ime i prezime" />
      <View style={styles.row}>
        <Pressable
          style={[styles.typeOption, form.documentType === 'PASSPORT' && styles.typeOptionActive]}
          onPress={() => updateField('documentType', 'PASSPORT')}
        >
          <Text style={form.documentType === 'PASSPORT' ? styles.typeOptionTextActive : styles.typeOptionText}>Pasoš</Text>
        </Pressable>
        <Pressable
          style={[styles.typeOption, form.documentType === 'LICNA_KARTA' && styles.typeOptionActive]}
          onPress={() => updateField('documentType', 'LICNA_KARTA')}
        >
          <Text style={form.documentType === 'LICNA_KARTA' ? styles.typeOptionTextActive : styles.typeOptionText}>Lična karta</Text>
        </Pressable>
      </View>
      <TextInput style={styles.input} value={form.documentNumber} onChangeText={(v) => updateField('documentNumber', v)} placeholder="Broj dokumenta" autoCapitalize="characters" />
      <TextInput style={styles.input} value={form.nationality} onChangeText={(v) => updateField('nationality', v)} placeholder="Državljanstvo" />
      <TextInput
        style={styles.input}
        value={form.dateOfBirth}
        onChangeText={(v) => updateField('dateOfBirth', v)}
        placeholder="Datum rođenja (GGGG-MM-DD)"
        keyboardType="numbers-and-punctuation"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, !canSave && styles.buttonDisabled]} disabled={!canSave} onPress={save}>
        <Text style={styles.buttonText}>{saving ? 'Čuvam…' : 'Sačuvaj profil'}</Text>
      </Pressable>
    </View>
  );
}

function maskDocumentNumber(value: string): string {
  if (value.length <= 3) return value;
  return `${'•'.repeat(value.length - 3)}${value.slice(-3)}`;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#555', marginBottom: 4 },
  card: { backgroundColor: '#f2f2f2', borderRadius: 12, padding: 16, gap: 4 },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardLine: { color: '#555' },
  scanButton: { backgroundColor: '#e6f0ff', borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1a4d8f' },
  scanButtonText: { color: '#1a4d8f', fontWeight: '600' },
  notice: { backgroundColor: '#fff3cd', borderRadius: 8, padding: 10, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', gap: 8 },
  typeOption: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center' },
  typeOptionActive: { borderColor: '#1a4d8f', backgroundColor: '#e6f0ff' },
  typeOptionText: { color: '#333' },
  typeOptionTextActive: { color: '#1a4d8f', fontWeight: '600' },
  error: { color: '#b00020' },
  button: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
