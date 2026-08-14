import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushSyncQueue } from '../lib/sync';
import { getQueueSize } from '../lib/sqlite';

// M9 spec §3.2 v1.4 — "čim se signal vrati" okidač za sinhronizaciju reda čekanja. Prati se
// samo za vodič stek (gost stek nema offline red čekanja), ali je bezbedno montirati globalno —
// flushSyncQueue je no-op kad je red prazan.
interface NetworkStatusValue {
  isConnected: boolean;
  queueSize: number;
  refreshQueueSize: () => Promise<void>;
}

const NetworkStatusContext = createContext<NetworkStatusValue>({
  isConnected: true,
  queueSize: 0,
  refreshQueueSize: async () => {},
});

export function useNetworkStatus(): NetworkStatusValue {
  return useContext(NetworkStatusContext);
}

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [queueSize, setQueueSize] = useState(0);

  async function refreshQueueSize() {
    setQueueSize(await getQueueSize());
  }

  useEffect(() => {
    refreshQueueSize();
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsConnected((wasConnected) => {
        if (!wasConnected && nowConnected) {
          flushSyncQueue()
            .catch(() => {
              // Best effort — sledeći signal (ili ručni "sinhronizuj sada") pokušava ponovo,
              // red čekanja ostaje netaknut na uređaju dok ne uspe.
            })
            .finally(refreshQueueSize);
        }
        return nowConnected;
      });
    });
    return unsubscribe;
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ isConnected, queueSize, refreshQueueSize }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}
