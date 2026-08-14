import { useLocalSearchParams } from 'expo-router';
import { TermsScreen } from '../../src/guest/TermsScreen';

export default function Uslovi() {
  const params = useLocalSearchParams<{
    productId: string;
    stayFrom: string;
    stayTo: string;
    adults: string;
    children: string;
    buyerName: string;
  }>();
  return <TermsScreen {...params} />;
}
