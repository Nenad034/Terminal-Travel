import { useLocalSearchParams } from 'expo-router';
import { OfferScreen } from '../../src/guest/OfferScreen';

export default function Ponuda() {
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
  return <OfferScreen {...params} />;
}
