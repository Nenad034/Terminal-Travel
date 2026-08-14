import { useLocalSearchParams } from 'expo-router';
import { GuestDataScreen } from '../../src/guest/GuestDataScreen';

export default function PodaciGosta() {
  const params = useLocalSearchParams<{
    productId: string;
    name: string;
    stayFrom: string;
    stayTo: string;
    adults: string;
    children: string;
    finalPrice: string;
    finalPriceCurrency: string;
  }>();
  return <GuestDataScreen {...params} />;
}
