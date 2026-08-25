import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { apiFetch } from '@/lib/api-client';
import BookingsListClient from './BookingsListClient';
import type { RealBooking } from './RealBookingsTable';
import RealFilterBar, { type BookingFilters } from './RealFilterBar';

// M5 spec v1.54 (24.8.2026, na zahtev vlasnika: "krenite" posle potvrđenog v1 skupa filtera) —
// STVARNA lista, prelazi sa MOCK-a (v1.42-v1.53). `GET /sales/bookings` sad prima pun v1 skup
// pravih filtera (vidi tabelu u spec-u); server komponenta samo prosleđuje `searchParams` kao
// query string, isti obrazac kao postojeći `/marketing`/`/podrska`/`/b2b/rabati`.
export default async function BookingListPage({ searchParams }: { searchParams: BookingFilters }) {
  let bookings: RealBooking[] = [];
  let error: string | null = null;
  try {
    // Multiselect (24.8.2026, na zahtev vlasnika) — `value` može biti `string[]` za polja sa
    // više izabranih opcija (status/uplata/tip nastupanja/tip proizvoda); svaka vrednost niza
    // se dodaje kao poseban `key=vrednost` par (`append`, ne `set`) da `GET /sales/bookings`
    // (poglavlje 11) dobije isti oblik ponovljenog parametra koji NestJS `@Query` prirodno
    // parsira nazad u niz.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (Array.isArray(value)) {
        for (const v of value) if (v) params.append(key, v);
      } else if (value) {
        params.set(key, value);
      }
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    bookings = await apiFetch<RealBooking[]>(`/sales/bookings${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u rezervacije (M5/booking/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Lista rezervacija" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> rezervacije/lista
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
          <Icon name="info" /> Filteri (status/uplata/datumi/destinacija/tip nastupanja/valuta/garancija putovanja) rade nad pravim
          podacima. Zvonce &quot;Hitno&quot;, kontakt, poslovnica, dodeljeni korisnik i naziv hotela su i dalje vizuelni primer bez
          pravog izvora — jasno obeleženi na svakom mestu gde se pojavljuju.
        </p>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {!error && <BookingsListClient bookings={bookings} filterBar={<RealFilterBar filters={searchParams ?? {}} />} />}
    </div>
  );
}
