import { ProcessMapDefinition } from './process-map.types';

// M18 spec §9a — drugi registrovan ProcessMapDefinition (dopunjeno 29.8.2026, na zahtev
// vlasnika: "proširimo mapu i na M5 tok rezervacije"). Namerno BEZ čvora za Ponudu (Quote) —
// kreiranje ponude se danas ne beleži u audit log (M5 spec §3.0e.3a beleži samo izuzetak
// "date_mismatch_override"), a vlasnik je izabrao (29.8.2026) da mapa prikazuje samo ono što
// se stvarno već beleži, ne da se uvodi novo, šire beleženje ponuda samo da bi mapa imala
// još jedan čvor.
export const M5_BOOKING_FLOW_PROCESS_MAP: ProcessMapDefinition = {
  key: 'm5-booking-flow',
  label: 'M5 — tok rezervacije',
  module: 'M5',
  nodes: [
    // `bookings.service.ts` upisuje isti audit `action: 'booking.confirmed'` bez obzira da li je
    // rezervacija odmah potvrđena ili čeka potvrdu dobavljača (razliku nosi samo Event Bus
    // emisija, ne audit log) — čvor namerno pokriva OBA slučaja, ne samo stvarno potvrđene.
    { id: 'booking-created', label: 'Rezervacija kreirana', matchActions: ['booking.confirmed'] },
    { id: 'booking-modified', label: 'Rezervacija izmenjena', matchActions: ['booking.modified'] },
    { id: 'payment-status-changed', label: 'Status plaćanja promenjen', matchActions: ['booking.payment_status_changed'] },
    { id: 'voucher-override', label: 'Vaučer bez pune uplate', matchActions: ['booking.voucher_override_issued'] },
    { id: 'booking-cancelled', label: 'Rezervacija otkazana', matchActions: ['booking.cancelled'] },
  ],
};
