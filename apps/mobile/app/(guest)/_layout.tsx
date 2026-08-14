import { Tabs } from 'expo-router';

export default function GuestLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="pretraga" options={{ title: 'Pretraga' }} />
      <Tabs.Screen name="moje-rezervacije" options={{ title: 'Moje rezervacije' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
      <Tabs.Screen name="ponuda" options={{ href: null, title: 'Ponuda' }} />
      <Tabs.Screen name="podaci-gosta" options={{ href: null, title: 'Podaci putnika' }} />
      <Tabs.Screen name="uslovi" options={{ href: null, title: 'Uslovi' }} />
      <Tabs.Screen name="placanje" options={{ href: null, title: 'Plaćanje' }} />
      <Tabs.Screen name="potvrda" options={{ href: null, title: 'Potvrda' }} />
      <Tabs.Screen name="vaucer/[bookingId]" options={{ href: null, title: 'Vaučer' }} />
    </Tabs>
  );
}
