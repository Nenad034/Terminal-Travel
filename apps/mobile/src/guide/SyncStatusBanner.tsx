import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../shared/NetworkStatusProvider';
import { flushSyncQueue } from '../lib/sync';

// M9 spec §3.2 v1.4 — vidljiv status reda čekanja (koliko čeka na sinhronizaciju) + ručni
// "sinhronizuj sada", pored automatskog okidača u NetworkStatusProvider.
export function SyncStatusBanner() {
  const { isConnected, queueSize, refreshQueueSize } = useNetworkStatus();

  if (queueSize === 0 && isConnected) return null;

  return (
    <View style={[styles.banner, isConnected ? styles.online : styles.offline]}>
      <Text style={styles.text}>
        {isConnected ? '' : 'Bez signala. '}
        {queueSize > 0 ? `${queueSize} stavki čeka na sinhronizaciju.` : ''}
      </Text>
      {isConnected && queueSize > 0 && (
        <Pressable
          onPress={async () => {
            await flushSyncQueue();
            await refreshQueueSize();
          }}
        >
          <Text style={styles.link}>sinhronizuj sada</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  online: { backgroundColor: '#fff3cd' },
  offline: { backgroundColor: '#f8d7da' },
  text: { flexShrink: 1 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
