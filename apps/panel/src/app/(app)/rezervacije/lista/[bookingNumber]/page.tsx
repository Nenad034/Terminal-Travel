import Link from 'next/link';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { MOCK_BOOKINGS } from '../mock-data';
import BookingRecordClient from './BookingRecordClient';

// "Pun zapis" (23.8.2026, na zahtev vlasnika: "Jos treba da osmislimo celu formu koja ce se
// otvarati klikom na broj rezervacije... dajte neki predlog" — predlog dat u razgovoru, potvrđen
// istog dana: "Da gradi po predlogu, s tim sto cemo sigurno imati izmene i dorade"). Otvara se
// preko `openTab` u nov app-tab (dizajn dok. §5b: "dupli klik/dugme 'Otvori' uvek otvara nov
// tab") — sa liste (klik na broj) ili iz sažetka u desnom panelu (dugme "Otvori pun zapis").
// I DALJE MOCK — čita direktno iz `MOCK_BOOKINGS` po broju rezervacije (lista nema stvarne DB
// ID-jeve), isto ograničenje kao ostatak ove faze (v1.42-v1.48).
//
// Dopuna (23.8.2026, "Izmeni" dugme, na zahtev vlasnika — videti mock-data.ts za pun kontekst):
// interaktivni deo (stavke/segmenti + workflow log) izdvojen u `BookingRecordClient.tsx`, ova
// stranica ostaje tanak server-komponent wrapper (pronalaženje po broju + prazno stanje).
export default function BookingFullRecordPage({ params }: { params: { bookingNumber: string } }) {
  const booking = MOCK_BOOKINGS.find((b) => b.bookingNumber === params.bookingNumber);

  if (!booking) {
    return (
      <div className="p-6">
        <RegisterTab label={params.bookingNumber} />
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">Rezervacija "{params.bookingNumber}" nije pronađena (mock lista).</p>
        <Link href="/rezervacije/lista" className="mt-3 inline-block text-xs text-accent hover:underline">
          ← nazad na listu
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <RegisterTab label={booking.bookingNumber} />
      <p className="mb-4 flex items-center gap-1.5 text-xs text-warn">
        <Icon name="warning" /> MOCK prikaz — izmišljen zapis, ne dolazi iz baze. Izmene stavki ispod ostaju samo u ovoj sesiji (nestaju pri osvežavanju stranice).
      </p>
      <BookingRecordClient booking={booking} />
    </div>
  );
}
