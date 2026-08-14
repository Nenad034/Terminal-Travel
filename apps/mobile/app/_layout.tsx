import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { NetworkStatusProvider } from '../src/shared/NetworkStatusProvider';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <NetworkStatusProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </NetworkStatusProvider>
    </QueryClientProvider>
  );
}
