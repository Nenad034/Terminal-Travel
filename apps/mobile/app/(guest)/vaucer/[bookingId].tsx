import { useLocalSearchParams } from 'expo-router';
import { VoucherScreen } from '../../../src/guest/VoucherScreen';

export default function Vaucer() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <VoucherScreen bookingId={bookingId} />;
}
