import { apiFetch, ApiError } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';

interface BookingItem {
  id: string;
  productId: string;
  supplierReference?: string;
  finalPrice: number;
  itemStatus: string;
}

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  voucherUrl: string | null;
  totalPrice?: number;
  currency?: string;
  items: BookingItem[];
}

// M17 spec §4 (Faza 1), M5 §6 GET /bookings/:id — poziv iz internog panela vraća
// pun (nemaskiran) prikaz, uključujući supplier_reference (M5 spec §6.2).
export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  let booking: Booking | null = null;
  let error: string | null = null;
  try {
    booking = await apiFetch<Booking>(`/sales/bookings/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Rezervacija nije pronađena.' : 'Rezervacija trenutno nije dostupna.';
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <RegisterTab label={booking?.bookingNumber ?? params.id.slice(0, 8)} />
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {booking && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-mono text-lg">
              <span className="text-accent">$</span> {booking.bookingNumber}
            </h1>
            <div className="flex gap-2">
              <Badge label={booking.status} />
              <Badge label={booking.paymentStatus} />
            </div>
          </div>

          {booking.voucherUrl ? (
            <a href={booking.voucherUrl} target="_blank" rel="noreferrer" className="mb-4 inline-block rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
              preuzmi vaučer
            </a>
          ) : (
            <p className="mb-4 text-xs text-ink-faint">Vaučer još nije izdat.</p>
          )}

          <div className="overflow-hidden rounded-lg border border-border">
            {booking.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <div>
                  <div className="text-ink">proizvod {item.productId.slice(0, 8)}…</div>
                  {item.supplierReference && <div className="text-xs text-ink-faint">ref. dobavljača: {item.supplierReference}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-ink">{(item.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}</span>
                  <Badge label={item.itemStatus} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'PAID'].includes(label) ? 'text-ok bg-ok-bg' : ['CANCELLED', 'UNPAID'].includes(label) ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}
