'use client';

import Icon from '@/components/Icon';

// Dopuna (23.8.2026, na zahtev vlasnika: "kada se klikne na zvono da se otvori modul u kom
// pise sta je to sto treba sto pre uraditi") — MOCK sadržaj (`urgent.reason` u mock-data.ts);
// pravi izvor bi kasnije bio ista M1 AuditLogEntry/HealthSignal logika koja već postoji za
// M18 operativna upozorenja, ne nov mehanizam.
//
// Dopuna (23.8.2026, na zahtev vlasnika: "kada imamo notifikacije kao sto je [ova] treba odmah
// odavde omoguciti slanje mejla i prikazati broj telefona koji treba da se pozove ili posalje
// poruka") — dugmad su `mailto:`/`tel:`/`sms:`/`wa.me` linkovi (isti obrazac kao klaster Mejl/
// Interni chat/WhatsApp/Viber/Telegram u `StatusBar.tsx`), NE stvarno slanje kroz M22 API — M22
// danas nema sposobnost sastavljanja/slanja proizvoljnog mejla (vidi M15 spec §6.9.3 napomenu),
// pravo slanje iz aplikacije čeka tu dopunu. Ovo otvara korisnikov podrazumevani mejl/telefon
// klijent sa već popunjenim poljima, isti nivo integracije kao postojeći spoljni linkovi.
export default function UrgentModal({
  bookingNumber,
  reason,
  buyerName,
  buyerEmail,
  buyerPhone,
  onClose,
}: {
  bookingNumber: string;
  reason: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  onClose: () => void;
}) {
  const mailtoHref = `mailto:${buyerEmail}?subject=${encodeURIComponent(`Rezervacija ${bookingNumber}`)}&body=${encodeURIComponent(`Poštovani/a ${buyerName},\n\n`)}`;
  const smsHref = `sms:${buyerPhone.replace(/\s+/g, '')}`;
  const telHref = `tel:${buyerPhone.replace(/\s+/g, '')}`;
  const whatsappHref = `https://wa.me/${buyerPhone.replace(/[^\d]/g, '')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-danger bg-panel shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-danger-bg px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-danger">
            <Icon name="bell" />
            Hitno — {bookingNumber}
          </div>
          <button onClick={onClose} title="Zatvori" className="text-danger hover:opacity-70">
            <Icon name="close" />
          </button>
        </div>
        <div className="px-4 py-3 text-xs text-ink-dim">{reason}</div>
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 text-[11px] text-ink-faint">Kontakt — {buyerName}</div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <a href={telHref} className="truncate font-mono text-ink hover:text-accent hover:underline">
              {buyerPhone}
            </a>
            <div className="flex flex-shrink-0 items-center gap-1">
              <a href={telHref} title="Pozovi" className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-accent">
                <Icon name="device-mobile" />
              </a>
              <a href={smsHref} title="Pošalji SMS" className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-accent">
                <Icon name="comment" />
              </a>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-accent">
                <Icon name="comment-discussion" />
              </a>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-ink-faint">{buyerEmail}</span>
            <a href={mailtoHref} title="Pošalji mejl" className="flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-ink-faint hover:bg-panel2 hover:text-accent">
              <Icon name="mail" /> Pošalji mejl
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
