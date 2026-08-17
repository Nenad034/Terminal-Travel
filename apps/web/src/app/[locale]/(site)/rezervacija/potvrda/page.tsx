import { getTranslations } from 'next-intl/server';
import { apiFetch } from '@/lib/api-client';
import type { Booking } from '@/lib/types';

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'booking.confirmation' });

  const booking = sp.bookingId
    ? await apiFetch<Booking>(`/sales/bookings/${sp.bookingId}`, { requireAuth: true }).catch(() => null)
    : null;

  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="mb-4 text-2xl font-semibold text-accent">{t('title')}</h1>
      {booking && (
        <>
          <p className="text-ink-dim">
            {t('bookingNumber')}: <strong>{booking.bookingNumber}</strong>
          </p>
          {booking.voucherUrl ? (
            <a href={booking.voucherUrl} className="mt-4 inline-block text-accent underline">
              {t('voucherLink')}
            </a>
          ) : (
            <p className="mt-4 text-sm text-ink-faint">{t('voucherPending')}</p>
          )}
          {sp.nacin === 'bank' && (
            <p className="mt-4 rounded-md bg-accent-soft p-3 text-sm">{/* uputstva za uplatu — poslato na email, M8 spec §3 korak 5 */}</p>
          )}
        </>
      )}
    </div>
  );
}
