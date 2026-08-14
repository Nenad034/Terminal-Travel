import { useLocalSearchParams } from 'expo-router';
import { PaymentScreen } from '../../src/guest/PaymentScreen';

export default function Placanje() {
  const { quoteId, buyerName } = useLocalSearchParams<{ quoteId: string; buyerName: string }>();
  return <PaymentScreen quoteId={quoteId} buyerName={buyerName} />;
}
