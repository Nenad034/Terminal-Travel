import { useLocalSearchParams } from 'expo-router';
import { ConfirmationScreen } from '../../src/guest/ConfirmationScreen';

export default function Potvrda() {
  const { bookingId, nacin } = useLocalSearchParams<{ bookingId: string; nacin?: string }>();
  return <ConfirmationScreen bookingId={bookingId} nacin={nacin} />;
}
