import { useLocalSearchParams } from 'expo-router';
import { BookingItemDetailScreen } from '../../../src/guide/BookingItemDetailScreen';

export default function Tura() {
  const { bookingItemId } = useLocalSearchParams<{ bookingItemId: string }>();
  return <BookingItemDetailScreen bookingItemId={bookingItemId} />;
}
