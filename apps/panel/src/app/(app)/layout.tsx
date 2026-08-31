import { redirect } from 'next/navigation';
import { getMe, hasPermission } from '@/lib/me';
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
  // M15 spec §6.9.2 — terminal panel, isključivo VLASNIK. Proveravano ovde (Server Component,
  // stvarna efektivna dozvola iz M1), ne pretpostavljano iz uloge po imenu u Shell.tsx.
  const showBiTerminal = hasPermission(me, 'M15', 'bi-terminal', 'VIEW');

  return (
    <Shell fullName={me.fullName} roles={me.roles} items={items} showBiTerminal={showBiTerminal}>
      {children}
    </Shell>
  );
}
