import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { visibleNavItems } from '@/lib/nav-visible';
import Shell from '@/components/Shell';

// M17 spec §3 — "Navigacija i vidljivost akcija na svakom ekranu potpuno prate M1 model
// prava". Ovaj layout obavija SVE autentifikovane ekrane (route group "(app)"), učitava
// sopstveni profil+prava jednom (getMe je react cache()) i filtrira navigaciju pre nego
// što stigne do klijenta — stavke bez dozvole se u potpunosti izostavljaju.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/prijava');

  const items = visibleNavItems(me);

  return (
    <Shell fullName={me.fullName} roles={me.roles} items={items}>
      {children}
    </Shell>
  );
}
