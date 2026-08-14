import { router } from 'expo-router';
import { RegisterScreen } from '../src/auth/RegisterScreen';

export default function Registracija() {
  return <RegisterScreen onRegistered={() => router.replace('/prijava')} />;
}
