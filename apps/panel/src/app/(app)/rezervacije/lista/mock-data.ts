// MOCK — probni prikaz (23.8.2026, na zahtev vlasnika: "kreiraj Mock listu rezervacija jedno
// 20 koje će se prikazivati u centralnom panelu, pa ćemo da vidimo kako ćemo dalje"). Podaci su
// izmišljeni, NE dolaze iz baze — svrha je da vlasnik vidi kako bi izgledala prava lista pre nego
// što se odluči tačan skup kolona i filtera (slike koje je poslao — "Rezervacija/Datum/Objekt/
// Gosti/Finansije/Projekti" — su putokaz, ne konačna specifikacija). Redovi prate oblik STVARNOG
// `Booking`/`BookingItem` Prisma modela (apps/api/prisma/schema.prisma) da mock ne izmišlja polja
// koja ne postoje — samo vrednosti u njima su lažne. Filteri namerno NISU deo ovog prolaza (dolaze
// u levi panel u sledećem koraku, po dogovoru).

export interface MockBookingRow {
  bookingNumber: string;
  buyerName: string;
  buyerType: 'FIZICKO_LICE' | 'PRAVNO_LICE';
  channel: 'B2C_SITE' | 'B2B_PORTAL' | 'MOBILE' | 'INTERNAL_PANEL' | 'PHONE' | 'MCP_AGENT';
  status: 'PENDING_SUPPLIER_CONFIRMATION' | 'CONFIRMED' | 'MODIFIED' | 'CANCELLED' | 'COMPLETED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'INVOICE_PENDING';
  stayFrom: string;
  stayTo: string;
  totalPrice: number;
  currency: string;
  createdAt: string;
}

export const MOCK_BOOKINGS: MockBookingRow[] = [
  { bookingNumber: 'TT-2026-100042', buyerName: 'Marko Petrović', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-07-10', stayTo: '2026-07-17', totalPrice: 89000, currency: 'EUR', createdAt: '2026-06-02' },
  { bookingNumber: 'TT-2026-100043', buyerName: 'Ana Jovanović', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'PENDING_SUPPLIER_CONFIRMATION', paymentStatus: 'UNPAID', stayFrom: '2026-08-01', stayTo: '2026-08-08', totalPrice: 145000, currency: 'EUR', createdAt: '2026-06-03' },
  { bookingNumber: 'TT-2026-100044', buyerName: 'Nikolić Travel d.o.o.', buyerType: 'PRAVNO_LICE', channel: 'B2B_PORTAL', status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', stayFrom: '2026-06-20', stayTo: '2026-06-27', totalPrice: 320000, currency: 'EUR', createdAt: '2026-06-04' },
  { bookingNumber: 'TT-2026-100045', buyerName: 'Milica Stanković', buyerType: 'FIZICKO_LICE', channel: 'MOBILE', status: 'CANCELLED', paymentStatus: 'UNPAID', stayFrom: '2026-07-05', stayTo: '2026-07-09', totalPrice: 42000, currency: 'EUR', createdAt: '2026-06-05' },
  { bookingNumber: 'TT-2026-100046', buyerName: 'Đorđe Ilić', buyerType: 'FIZICKO_LICE', channel: 'PHONE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-15', stayTo: '2026-06-22', totalPrice: 67000, currency: 'EUR', createdAt: '2026-06-06' },
  { bookingNumber: 'TT-2026-100047', buyerName: 'Jelena Radovanović', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'COMPLETED', paymentStatus: 'PAID', stayFrom: '2026-05-01', stayTo: '2026-05-08', totalPrice: 95000, currency: 'EUR', createdAt: '2026-04-02' },
  { bookingNumber: 'TT-2026-100048', buyerName: 'Stefan Pavlović', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-25', stayTo: '2026-07-02', totalPrice: 158000, currency: 'EUR', createdAt: '2026-06-08' },
  { bookingNumber: 'TT-2026-100049', buyerName: 'Balkan Tours d.o.o.', buyerType: 'PRAVNO_LICE', channel: 'B2B_PORTAL', status: 'MODIFIED', paymentStatus: 'PARTIALLY_PAID', stayFrom: '2026-06-18', stayTo: '2026-06-25', totalPrice: 410000, currency: 'EUR', createdAt: '2026-06-09' },
  { bookingNumber: 'TT-2026-100050', buyerName: 'Vuk Nikolić', buyerType: 'FIZICKO_LICE', channel: 'MOBILE', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-08-10', stayTo: '2026-08-17', totalPrice: 112000, currency: 'EUR', createdAt: '2026-06-10' },
  { bookingNumber: 'TT-2026-100051', buyerName: 'Ivana Đukić', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-30', stayTo: '2026-07-06', totalPrice: 76000, currency: 'EUR', createdAt: '2026-06-11' },
  { bookingNumber: 'TT-2026-100052', buyerName: 'Miloš Simić', buyerType: 'FIZICKO_LICE', channel: 'PHONE', status: 'CANCELLED', paymentStatus: 'UNPAID', stayFrom: '2026-07-15', stayTo: '2026-07-20', totalPrice: 53000, currency: 'EUR', createdAt: '2026-06-12' },
  { bookingNumber: 'TT-2026-100053', buyerName: 'Teodora Mitrović', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'PENDING_SUPPLIER_CONFIRMATION', paymentStatus: 'UNPAID', stayFrom: '2026-08-20', stayTo: '2026-08-27', totalPrice: 189000, currency: 'EUR', createdAt: '2026-06-13' },
  { bookingNumber: 'TT-2026-100054', buyerName: 'Aleksandar Kostić', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-06-22', stayTo: '2026-06-29', totalPrice: 98000, currency: 'EUR', createdAt: '2026-06-14' },
  { bookingNumber: 'TT-2026-100055', buyerName: 'Sunrise Agencija d.o.o.', buyerType: 'PRAVNO_LICE', channel: 'B2B_PORTAL', status: 'CONFIRMED', paymentStatus: 'INVOICE_PENDING', stayFrom: '2026-07-01', stayTo: '2026-07-14', totalPrice: 560000, currency: 'EUR', createdAt: '2026-06-15' },
  { bookingNumber: 'TT-2026-100056', buyerName: 'Nataša Popović', buyerType: 'FIZICKO_LICE', channel: 'MOBILE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-08-05', stayTo: '2026-08-12', totalPrice: 121000, currency: 'EUR', createdAt: '2026-06-16' },
  { bookingNumber: 'TT-2026-100057', buyerName: 'Filip Đorđević', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'COMPLETED', paymentStatus: 'PAID', stayFrom: '2026-05-10', stayTo: '2026-05-15', totalPrice: 64000, currency: 'EUR', createdAt: '2026-04-11' },
  { bookingNumber: 'TT-2026-100058', buyerName: 'Katarina Vasić', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-28', stayTo: '2026-07-03', totalPrice: 87000, currency: 'EUR', createdAt: '2026-06-17' },
  { bookingNumber: 'TT-2026-100059', buyerName: 'AI Agent (MCP)', buyerType: 'PRAVNO_LICE', channel: 'MCP_AGENT', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-07-20', stayTo: '2026-07-27', totalPrice: 203000, currency: 'EUR', createdAt: '2026-06-18' },
  { bookingNumber: 'TT-2026-100060', buyerName: 'Dušan Lazić', buyerType: 'FIZICKO_LICE', channel: 'PHONE', status: 'MODIFIED', paymentStatus: 'PARTIALLY_PAID', stayFrom: '2026-08-15', stayTo: '2026-08-22', totalPrice: 134000, currency: 'EUR', createdAt: '2026-06-19' },
  { bookingNumber: 'TT-2026-100061', buyerName: 'Marija Todorović', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-24', stayTo: '2026-06-30', totalPrice: 71000, currency: 'EUR', createdAt: '2026-06-20' },
];
