import { router } from 'expo-router';
import { LoginScreen } from '../src/auth/LoginScreen';

export default function Prijava() {
  return (
    <LoginScreen
      onSuccess={(role) => {
        router.replace(role === 'VODIC' ? '/(guide)/itinerar' : '/(guest)/pretraga');
      }}
    />
  );
}
