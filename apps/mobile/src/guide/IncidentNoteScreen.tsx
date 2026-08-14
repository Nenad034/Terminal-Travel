import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { enqueueIncidentNote, type QueuedIncidentNote } from '../lib/sqlite';
import { flushSyncQueue } from '../lib/sync';
import { useNetworkStatus } from '../shared/NetworkStatusProvider';

const SEVERITIES: QueuedIncidentNote['severity'][] = ['INFO', 'WARNING', 'URGENT'];
const SEVERITY_LABELS: Record<QueuedIncidentNote['severity'], string> = {
  INFO: 'Informativno',
  WARNING: 'Upozorenje',
  URGENT: 'Hitno',
};

// M9 spec §3.3 v1.4 — beleška o problemu na terenu, tri nivoa ozbiljnosti. URGENT čim se
// sinhronizuje odmah generiše upozorenje timu (field-staff.service.ts, audit log + Event Bus).
export function IncidentNoteScreen({ bookingId }: { bookingId: string }) {
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState<QueuedIncidentNote['severity']>('INFO');
  const [saving, setSaving] = useState(false);
  const { isConnected, refreshQueueSize } = useNetworkStatus();

  async function submit() {
    if (!note.trim()) return;
    setSaving(true);
    await enqueueIncidentNote({ id: randomUUID(), bookingId, note: note.trim(), severity, createdAt: new Date().toISOString() });
    await refreshQueueSize();
    if (isConnected) {
      try {
        await flushSyncQueue();
        await refreshQueueSize();
      } catch {
        // Ostaje u redu, sledeći pokušaj je pokriva.
      }
    } else {
      Alert.alert('Sačuvano lokalno', 'Bez signala — beleška će se poslati čim se veza vrati.');
    }
    setSaving(false);
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Beleška o problemu</Text>
      <View style={styles.severityRow}>
        {SEVERITIES.map((s) => (
          <Pressable key={s} style={[styles.severityChip, severity === s && styles.severityChipActive]} onPress={() => setSeverity(s)}>
            <Text style={[styles.severityChipText, severity === s && styles.severityChipTextActive]}>{SEVERITY_LABELS[s]}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.textArea}
        value={note}
        onChangeText={setNote}
        placeholder="Opišite šta se dešava..."
        multiline
        numberOfLines={6}
        autoFocus
      />
      <Pressable style={styles.submitButton} onPress={submit} disabled={saving || !note.trim()}>
        <Text style={styles.submitButtonText}>Sačuvaj</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  severityChipActive: { backgroundColor: '#b00020', borderColor: '#b00020' },
  severityChipText: { color: '#333' },
  severityChipTextActive: { color: '#fff', fontWeight: '600' },
  textArea: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, minHeight: 140, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#1a4d8f', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
