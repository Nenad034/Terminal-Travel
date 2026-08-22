import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { MOCK_BOOKINGS } from './mock-data';

// MOCK stranica (23.8.2026, na zahtev vlasnika — vidi mock-data.ts za pun kontekst zahteva).
// Namerno BEZ poziva ka `GET /bookings` i BEZ filtera u levom panelu — ovo je prvi korak
// ("da vidimo kako će izgledati"), filteri dolaze u sledećem prolazu pošto se vlasnik odluči za
// tačan skup (slike koje je poslao su putokaz, ne konačna specifikacija za M5).
function StatusBadge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'COMPLETED'].includes(label)
    ? 'text-ok bg-ok-bg'
    : label === 'CANCELLED'
      ? 'text-danger bg-danger-bg'
      : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function PaymentBadge({ label }: { label: string }) {
  const tone = label === 'PAID' ? 'text-ok bg-ok-bg' : label === 'UNPAID' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function formatMoney(amount: number, currency: string): string {
  return `${(amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sr-RS');
}

export default function BookingListMockPage() {
  return (
    <div className="p-6">
      <RegisterTab label="Lista rezervacija" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> rezervacije/lista
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-warn">
          <Icon name="warning" /> MOCK prikaz — izmišljeni podaci, ne dolaze iz baze. Filteri (levi panel) dolaze u sledećem koraku.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-panel2 text-ink-faint">
              <th className="px-3 py-2 font-medium">Broj</th>
              <th className="px-3 py-2 font-medium">Nosilac rezervacije</th>
              <th className="px-3 py-2 font-medium">Kanal</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Uplata</th>
              <th className="px-3 py-2 font-medium">Dolazak</th>
              <th className="px-3 py-2 font-medium">Odlazak</th>
              <th className="px-3 py-2 text-right font-medium">Iznos</th>
              <th className="px-3 py-2 font-medium">Kreirano</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_BOOKINGS.map((b) => (
              <tr key={b.bookingNumber} className="border-b border-border last:border-0 hover:bg-panel2">
                <td className="px-3 py-2 font-mono text-ink">{b.bookingNumber}</td>
                <td className="px-3 py-2 text-ink-dim">{b.buyerName}</td>
                <td className="px-3 py-2 text-ink-faint">{b.channel}</td>
                <td className="px-3 py-2">
                  <StatusBadge label={b.status} />
                </td>
                <td className="px-3 py-2">
                  <PaymentBadge label={b.paymentStatus} />
                </td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.stayFrom)}</td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.stayTo)}</td>
                <td className="px-3 py-2 text-right font-mono text-ink">{formatMoney(b.totalPrice, b.currency)}</td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">{MOCK_BOOKINGS.length} rezervacija (mock)</p>
    </div>
  );
}
