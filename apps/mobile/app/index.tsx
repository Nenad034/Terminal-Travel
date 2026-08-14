import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getSession } from '../src/lib/session';

// M9 §1 v1.4 — grana po ulozi prijavljenog korisnika: VODIC ide u vodič stek, svako drugo
// uspešno prijavljen (GOST) u gost stek, bez sesije nazad na prijavu.
export default function Index() {
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) {
        router.replace('/prijava');
      } else if (session.role === 'VODIC') {
        router.replace('/(guide)/itinerar');
      } else {
        router.replace('/(guest)/pretraga');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
