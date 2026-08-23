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
//
// Dopuna (23.8.2026, na zahtev vlasnika: "treba razlikovati obavestenja koje saljemo klijentima
// i partnerima, dobavljacima po logici stvari") — problem koji čeka rok NIJE uvek kod gosta:
// "čeka potvrdu dobavljača" znači treba kontaktirati DOBAVLJAČA (M3 `Supplier.contact_*`), ne
// klijenta. `target` (mock-data.ts) bira ispravan kontakt i ton poruke — dobavljaču se ne piše
// "Poštovani/a Marko" nego formalno ime firme/kontakt osobe.
//
// Dopuna (23.8.2026, na zahtev vlasnika: "jedna rezervacija moze da ima vise notifikacija...
// treba da se pojave 1,2,3... onoliko mini modula koliko ima notifikacija") — `notifications` je
// sad niz; svaka stavka dobija sopstveni numerisan mini-modul (own reason + own target/kontakt,
// mogu biti mešoviti — jedan ka dobavljaču, drugi ka klijentu, na istoj rezervaciji), stack unutar
// jednog overlay-a sa jednim zajedničkim "Zatvori".
interface UrgentNotification {
  reason: string;
  target: 'BUYER' | 'SUPPLIER';
}

function NotificationCard({
  index,
  total,
  notification,
  bookingNumber,
  buyerName,
  buyerEmail,
  buyerPhone,
  supplierName,
  supplierEmail,
  supplierPhone,
}: {
  index: number;
  total: number;
  notification: UrgentNotification;
  bookingNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  supplierName: string;
  supplierEmail: string;
  supplierPhone: string;
}) {
  const isSupplier = notification.target === 'SUPPLIER';
  const contactLabel = isSupplier ? `Dobavljač — ${supplierName}` : `Klijent/nalogodavac — ${buyerName}`;
  const contactEmail = isSupplier ? supplierEmail : buyerEmail;
  const contactPhone = isSupplier ? supplierPhone : buyerPhone;
  const mailSubject = isSupplier ? `Potvrda dostupnosti — rezervacija ${bookingNumber}` : `Rezervacija ${bookingNumber}`;
  const mailGreeting = isSupplier ? `Poštovani,\n\nu vezi sa rezervacijom ${bookingNumber}: ` : `Poštovani/a ${buyerName},\n\n`;
  const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailGreeting)}`;
  const smsHref = `sms:${contactPhone.replace(/\s+/g, '')}`;
  const telHref = `tel:${contactPhone.replace(/\s+/g, '')}`;
  const whatsappHref = `https://wa.me/${contactPhone.replace(/[^\d]/g, '')}`;

  return (
    <div className="overflow-hidden rounded-lg border border-danger bg-panel shadow-lg">
      <div className="flex items-center justify-between border-b border-border bg-danger-bg px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-danger">
          <Icon name="bell" />
          Hitno {total > 1 ? `${index + 1}/${total}` : ''} — {bookingNumber}
        </div>
      </div>
      <div className="px-4 py-3 text-xs text-ink-dim">{notification.reason}</div>
      <div className="border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Icon name={isSupplier ? 'organization' : 'account'} />
          {contactLabel}
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <a href={telHref} className="truncate font-mono text-ink hover:text-accent hover:underline">
            {contactPhone}
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
          <span className="truncate text-ink-faint">{contactEmail}</span>
          <a href={mailtoHref} title="Pošalji mejl" className="flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-ink-faint hover:bg-panel2 hover:text-accent">
            <Icon name="mail" /> Pošalji mejl
          </a>
        </div>
      </div>
    </div>
  );
}

export default function UrgentModal({
  bookingNumber,
  notifications,
  buyerName,
  buyerEmail,
  buyerPhone,
  supplierName,
  supplierEmail,
  supplierPhone,
  onClose,
}: {
  bookingNumber: string;
  notifications: UrgentNotification[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  supplierName: string;
  supplierEmail: string;
  supplierPhone: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end">
          <button onClick={onClose} title="Zatvori sve" className="flex h-6 w-6 items-center justify-center rounded bg-panel text-danger shadow hover:opacity-70">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {notifications.map((n, i) => (
            <NotificationCard
              key={i}
              index={i}
              total={notifications.length}
              notification={n}
              bookingNumber={bookingNumber}
              buyerName={buyerName}
              buyerEmail={buyerEmail}
              buyerPhone={buyerPhone}
              supplierName={supplierName}
              supplierEmail={supplierEmail}
              supplierPhone={supplierPhone}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
