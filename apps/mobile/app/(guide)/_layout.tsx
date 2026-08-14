import { Tabs } from 'expo-router';

export default function GuideLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="itinerar" options={{ title: 'Itinerar' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
      <Tabs.Screen name="tura/[bookingItemId]" options={{ href: null, title: 'Tura' }} />
      <Tabs.Screen name="beleska/[bookingId]" options={{ href: null, title: 'Beleška' }} />
    </Tabs>
  );
}
