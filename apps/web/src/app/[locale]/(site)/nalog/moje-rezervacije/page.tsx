import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import type { Booking } from '@/lib/types';


// M5 spec §6.2 dopuna — GET /sales/bookings vraća samo sopstvene rezervacije za
// account_type GUEST (ownership sprovodi BookingsService, ne ovaj kod).
export default async function MyBookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.myBookings' });

  const session = await getSession();
  if (!session) redirect(`/${locale}/nalog/prijava`);

  // Straničen odgovor od 5.9.2026 (dok. 39 nalaz 2.2) — `{ data, total, ... }`. Gost realno
  // ima nekoliko rezervacija, pa je prva stranica dovoljna; kad neko pređe podrazumevanih 50,
  // ovde treba dugme „prikaži još" (zavedeno u backlogu, nije prećutano).
  const bookings = await apiFetch<{ data: Booking[] }>('/sales/bookings', { requireAuth: true })
    .then((r) => r.data)
    .catch(() => []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      {bookings.length === 0 ? (
        <p className="text-ink-faint">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{b.bookingNumber}</p>
              <p className="text-sm text-ink-faint">
                {t('status')}: {b.status} — {b.paymentStatus}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
