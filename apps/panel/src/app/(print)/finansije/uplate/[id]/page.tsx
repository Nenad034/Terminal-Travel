import { redirect } from 'next/navigation';
import { getMe, hasPermission } from '@/lib/me';
import { apiFetch, ApiError } from '@/lib/api-client';
import PrintButton from './PrintButton';

interface CheckDetail {
  id: string;
  amount: number;
  checkNumber: string;
  clearanceDate: string;
  bank: { name: string };
}

interface PaymentDetail {
  id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  receivedAt: string | null;
  createdAt: string;
  bank: { name: string } | null;
  checkDetails: CheckDetail[];
  booking: { bookingNumber: string; buyerName: string } | null;
}

function formatMoney(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// M10 spec §5.2 dopuna (2.9.2026, na zahtev vlasnika — "omogućiti pregled i štampanje
// specifikacije čekova"). Namerno u sopstvenoj `(print)` route grupi (bez Shell bočne trake/
// topbar-a iz (app)/layout.tsx) — čista strana za štampu, isti princip kao apps/web vaučer.
// Auth se proverava OVDE direktno (ova grupa ne nasleđuje (app) proveru).
export default async function CheckSpecificationPage({ params }: { params: Promise<{ id: string }> }) {
  const params_ = await params;
  const me = await getMe();
  if (!me) redirect('/prijava');
  if (!hasPermission(me, 'M10', 'payment', 'VIEW')) {
    return <div className="p-8 text-sm text-ink-faint">Nemate dozvolu za uvid u uplate (M10/payment/VIEW).</div>;
  }

  const payment = await apiFetch<PaymentDetail>(`/finance/payments/${params_.id}`).catch((err) =>
    err instanceof ApiError && err.status === 404 ? null : Promise.reject(err),
  );

  if (!payment) {
    return <div className="p-8 text-sm text-ink-faint">Uplata nije pronađena.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Specifikacija čekova</h1>
          {payment.booking && (
            <p className="mt-1 text-sm text-ink-dim">
              Rezervacija: <strong>{payment.booking.bookingNumber}</strong> — {payment.booking.buyerName}
            </p>
          )}
          <p className="text-sm text-ink-dim">
            Ukupan iznos uplate: <strong>{formatMoney(payment.amount, payment.currency)}</strong>
            {' · '}
            {new Date(payment.receivedAt ?? payment.createdAt).toLocaleDateString('sr-RS')}
            {payment.reference && ` · ${payment.reference}`}
          </p>
        </div>
        <PrintButton />
      </div>

      {payment.checkDetails.length === 0 ? (
        <p className="text-sm text-ink-faint">Ova uplata nema specifikaciju čekova (metod {payment.method}).</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-3">Banka</th>
              <th className="py-2 pr-3">Broj čeka</th>
              <th className="py-2 pr-3">Datum realizacije</th>
              <th className="py-2 text-right">Iznos</th>
            </tr>
          </thead>
          <tbody>
            {payment.checkDetails.map((c) => (
              <tr key={c.id} className="border-b border-border">
                <td className="py-2 pr-3 text-ink">{c.bank.name}</td>
                <td className="py-2 pr-3 text-ink">{c.checkNumber}</td>
                <td className="py-2 pr-3 text-ink">{new Date(c.clearanceDate).toLocaleDateString('sr-RS')}</td>
                <td className="py-2 text-right font-mono text-ink">{formatMoney(c.amount, payment.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 pr-3 text-right text-xs uppercase tracking-wide text-ink-faint">
                Ukupno
              </td>
              <td className="py-2 text-right font-mono font-semibold text-ink">
                {formatMoney(
                  payment.checkDetails.reduce((s, c) => s + c.amount, 0),
                  payment.currency,
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
