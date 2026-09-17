import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import IntakeScreen from './IntakeScreen';

// M5 spec §3.0j (v2.53) — „Nova ponuda iz teksta": agent nalepi mejl dobavljača ili zahtev
// klijenta, AI pročita, kod upari sa katalogom, čovek pregleda i klikom napravi nacrt ponude.

export const dynamic = 'force-dynamic';

export default async function NovaPonudaIzTekstaPage() {
  const me = await getMe();
  if (!hasPermission(me, 'M5', 'quote', 'CREATE')) {
    return (
      <div className="p-6">
        <RegisterTab label="Ponuda iz teksta" />
        <p className="rounded-lg border border-border bg-panel p-4 text-sm text-ink-dim">
          Nemate pravo kreiranja ponude (M5/quote/CREATE).
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 p-6">
      <RegisterTab label="Ponuda iz teksta" />
      <div>
        <h1 className="text-lg font-semibold text-ink">Nova ponuda iz teksta</h1>
        <p className="text-xs text-ink-faint">
          <Icon name="mail" /> nalepite mejl hotela ili poruku klijenta — AI pročita, sistem upari
          sa katalogom, vi pregledate i napravite nacrt
        </p>
      </div>
      <IntakeScreen />
    </div>
  );
}
