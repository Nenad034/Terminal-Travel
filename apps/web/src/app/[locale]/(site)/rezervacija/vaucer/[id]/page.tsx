import { getTranslations } from 'next-intl/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { VoucherContent } from '@/lib/types';
import PrintButton from './PrintButton';

// M5 spec §6 dopuna (2.9.2026, na zahtev vlasnika: "podaci predstavnika treba automatski da se
// pojave na vaučeru") — PRVI stvaran sadržaj vaučera u sistemu; do sada je `Booking.voucherUrl`
// bio mock link bez ijednog reda sadržaja (§13 "format vaučera van obima"). Javna stranica —
// isti "kapacitetski link" princip kao mock URL koji je zamenjen (rezervacije UUID direktno u
// putanji, bez prijave), poziva neautentifikovan `GET /sales/bookings/public/:id/voucher`
// (`auth: false` — gost ovu stranicu otvara bez naloga, isto kao pre).
export default async function VoucherPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'booking.voucher' });

  const voucher = await apiFetch<VoucherContent>(`/sales/bookings/public/${id}/voucher`, { auth: false }).catch((err) =>
    err instanceof ApiError && err.status === 404 ? null : Promise.reject(err),
  );

  if (!voucher) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-ink-dim">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-accent">{t('title')}</h1>
          <p className="mt-1 text-sm text-ink-dim">
            {t('bookingNumber')}: <strong>{voucher.bookingNumber}</strong>
          </p>
          <p className="text-sm text-ink-dim">
            {t('buyer')}: <strong>{voucher.buyerName}</strong>
          </p>
        </div>
        <PrintButton label={t('print')} />
      </div>

      <div className="space-y-4">
        {voucher.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="mb-2 text-sm font-semibold text-ink">
              {t('service')}: {item.productName ?? '—'}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink-dim sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">{t('destination')}</dt>
                <dd>{[item.destinationCity, item.destinationCountry].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">{t('dates')}</dt>
                <dd>
                  {new Date(item.stayFrom).toLocaleDateString(locale)} – {new Date(item.stayTo).toLocaleDateString(locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">{t('units')}</dt>
                <dd>{item.unitCount}</dd>
              </div>
            </dl>

            {item.guests.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-ink-faint">{t('guests')}</div>
                <ul className="mt-1 text-sm text-ink-dim">
                  {item.guests.map((g, gi) => (
                    <li key={gi}>
                      {g.guestFirstName} {g.guestLastName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 rounded border border-border bg-accent-soft/40 p-3">
              <div className="text-xs uppercase tracking-wide text-ink-faint">{t('representative')}</div>
              {item.representative ? (
                <div className="mt-1 text-sm text-ink-dim">
                  <div className="font-medium text-ink">{item.representative.fullName}</div>
                  {item.representative.phone && (
                    <div>
                      {t('phone')}: {item.representative.phone}
                    </div>
                  )}
                  {item.representative.email && (
                    <div>
                      {t('email')}: {item.representative.email}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-ink-faint">{t('noRepresentative')}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
