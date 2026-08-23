import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { MOCK_BOOKINGS } from './mock-data';
import BookingsTable from './BookingsTable';

// MOCK stranica (23.8.2026, na zahtev vlasnika — vidi mock-data.ts za pun kontekst zahteva).
// Namerno BEZ poziva ka `GET /bookings` — ovo je i dalje prvi korak ("da vidimo kako će
// izgledati"). Filteri po koloni i dugme za tok rezervacije DODATI (23.8.2026, isti dan, na
// zahtev vlasnika) — vidi `BookingsTable.tsx` (klijentska komponenta, filtriranje/modal).
export default function BookingListMockPage() {
  return (
    <div className="p-6">
      <RegisterTab label="Lista rezervacija" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> rezervacije/lista
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-warn">
          <Icon name="warning" /> MOCK prikaz — izmišljeni podaci, ne dolaze iz baze. Ikonica toka rezervacije prikazuje izmišljen
          tok dok lista ne bude povezana na pravu bazu (pravi endpoint već postoji: `GET /sales/bookings/:id/history`).
        </p>
      </div>

      <BookingsTable bookings={MOCK_BOOKINGS} />
    </div>
  );
}
