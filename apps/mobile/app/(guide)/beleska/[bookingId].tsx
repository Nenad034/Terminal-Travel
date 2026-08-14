import { useLocalSearchParams } from 'expo-router';
import { IncidentNoteScreen } from '../../../src/guide/IncidentNoteScreen';

export default function Beleska() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <IncidentNoteScreen bookingId={bookingId} />;
}
