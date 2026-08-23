// MOCK — probni prikaz (23.8.2026, na zahtev vlasnika: "kreiraj Mock listu rezervacija jedno
// 20 koje će se prikazivati u centralnom panelu, pa ćemo da vidimo kako ćemo dalje"). Podaci su
// izmišljeni, NE dolaze iz baze — svrha je da vlasnik vidi kako bi izgledala prava lista pre nego
// što se odluči tačan skup kolona i filtera. Redovi prate oblik STVARNOG `Booking`/`BookingItem`
// Prisma modela (apps/api/prisma/schema.prisma) da mock ne izmišlja polja koja ne postoje — samo
// vrednosti u njima su lažne. **I dalje mock (23.8.2026, na zahtev vlasnika: "moracete za sada
// jos da radite sa Mock podacima jer jos necemo u produkciju")** — ostaje tako dok se ne donese
// odluka o povezivanju na pravu bazu.
//
// Dopuna (23.8.2026): `country`/`destinationCity`/`hotelName` (M2/M5 polja), `travelers[]` sad
// STRUKTURIRAN (ime + kategorija odrasla-osoba/dete/beba + godina rođenja za decu/bebe — na
// zahtev vlasnika: "Svuda Prikazati da li je osoba odrasla osoba, dete ili beba"), `productType`
// (stvaran `ProductType` enum, M2 spec — koristi isti `PRODUCT_ICONS` katalog kao pretraga,
// `lib/search-product-types.ts`, ne izmišlja novu ikonografiju), `urgent` (crveno zvonce — "sta
// je to sto treba sto pre uraditi"), `branch`/`assignedUser`/`supplierName`/`partnerName` (novi
// filteri — Poslovnica/User/Dobavljač/Partner).

export type AgeCategory = 'ADULT' | 'CHILD' | 'BABY';

export interface Traveler {
  name: string;
  ageCategory: AgeCategory;
  /** Obavezno za CHILD/BABY, opciono za ADULT (samo ako je stvarno unet podatak). */
  birthYear?: number;
}

// Stavke (segmenti) rezervacije — dopuna (23.8.2026, na zahtev vlasnika, uz "Izmeni" dugme u
// punom zapisu: "za svaki segment da se pojavi modul u kom ce se unositi rucno podaci novi ili
// menjatu stari"). Tri načina unosa koje je vlasnik opisao odgovaraju VEĆ POSTOJEĆEM
// `source_type` modelu za `QuoteItem`/`BookingItem` (M5 spec poglavlje 3.0f, 3.2/4.2) — ne novi
// koncept, samo prvi put primenjen i na IZMENU već potvrđene rezervacije, ne samo na pravljenje
// nove ponude:
// 1. CONTRACTED — ručan izbor iz kataloga (država/destinacija/hotel/soba/usluga), ručan unos
//    ulazne cene i marže (% i/ili iznos) — izlazna cena se računa.
// 2. API — cena/uslovi dolaze od dobavljača (M4), agent unosi samo putnike — polja cene su
//    informativna/samo za čitanje ovde (isto pravilo kao M5 spec poglavlje 3.0b.4: cena u
//    rezultatima pretrage nije konačna garancija).
// 3. MANUAL — iz baze već unetih aranžmana (`ManualProductEntry`, M5 spec poglavlje 3.0f.1),
//    ručno ili uz AI-agent asistirano popunjavanje (poglavlje 3.0f.2) — AI deo NAMERNO nije
//    povezan u ovom mock ekranu (zahteva stvaran M15 modul), obeleženo kao "čeka poseban prolaz".
export type ItemSourceType = 'CONTRACTED' | 'API' | 'MANUAL';

export interface MockBookingItem {
  id: string;
  sourceType: ItemSourceType;
  productType: MockBookingRow['productType'];
  country: string;
  destinationCity: string;
  hotelName: string;
  roomType: string;
  serviceType: string;
  /** Ulazna cena (base_cost) — najmanja jedinica valute, ista konvencija kao ostatak M5. */
  baseCost: number;
  marginPercent: number;
  marginAmount: number;
  /** Izlazna cena (final_price). */
  finalPrice: number;
  currency: string;
}

export interface MockBookingRow {
  bookingNumber: string;
  buyerName: string;
  /** Stvaran izvor bi bio `ClientAccount.email`/`.phone` (M6 spec §2.1) — ovde izvedeno iz imena/broja rezervacije kad nije ručno uneto. */
  buyerEmail: string;
  buyerPhone: string;
  buyerType: 'FIZICKO_LICE' | 'PRAVNO_LICE';
  channel: 'B2C_SITE' | 'B2B_PORTAL' | 'MOBILE' | 'INTERNAL_PANEL' | 'PHONE' | 'MCP_AGENT';
  status: 'PENDING_SUPPLIER_CONFIRMATION' | 'CONFIRMED' | 'MODIFIED' | 'CANCELLED' | 'COMPLETED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'INVOICE_PENDING';
  stayFrom: string;
  stayTo: string;
  totalPrice: number;
  currency: string;
  createdAt: string;
  country: string;
  destinationCity: string;
  hotelName: string;
  accommodationType: string;
  travelers: Traveler[];
  paidAmount: number;
  productType: 'ACCOMMODATION' | 'PACKAGE' | 'CRUISE' | 'INSURANCE';
  urgent: { reason: string } | null;
  branch: string;
  assignedUser: string;
  supplierName: string;
  partnerName: string | null;
  items: MockBookingItem[];
}

// Dopuna (23.8.2026, na zahtev vlasnika: "kada imamo notifikacije... omoguciti slanje mejla i
// prikazati broj telefona") — `UrgentModal` treba kontakt gosta/nalogodavca. Umesto ručnog unosa
// u svih 20 mock redova, izvodi se deterministički iz imena/broja rezervacije (kao `paidAmount`
// iznad) kad nije ručno navedeno — polje u modelu je stvarno (`ClientAccount.email`/`.phone`),
// samo vrednost izmišljena.
function slugifyName(name: string): string {
  const map: Record<string, string> = { č: 'c', ć: 'c', ž: 'z', š: 's', đ: 'dj', Č: 'c', Ć: 'c', Ž: 'z', Š: 's', Đ: 'dj' };
  return name
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
}

function deriveEmail(buyerName: string): string {
  return `${slugifyName(buyerName)}@primer.local`;
}

function derivePhone(bookingNumber: string): string {
  const digits = bookingNumber.replace(/\D/g, '').slice(-7).padStart(7, '0');
  return `+381 6${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)}`;
}

function withDerived(
  row: Omit<MockBookingRow, 'paidAmount' | 'items' | 'buyerEmail' | 'buyerPhone'> & {
    paidAmount?: number;
    items?: MockBookingItem[];
    buyerEmail?: string;
    buyerPhone?: string;
  },
): MockBookingRow {
  const paidAmount =
    row.paidAmount ??
    (row.paymentStatus === 'PAID' ? row.totalPrice : row.paymentStatus === 'PARTIALLY_PAID' ? Math.round(row.totalPrice * 0.4) : 0);
  const items = row.items ?? [defaultItem(row)];
  const buyerEmail = row.buyerEmail ?? deriveEmail(row.buyerName);
  const buyerPhone = row.buyerPhone ?? derivePhone(row.bookingNumber);
  return { ...row, paidAmount, items, buyerEmail, buyerPhone };
}

// Podrazumevana jedna stavka izvedena iz postojećih pljosnatih polja (23.8.2026) — mock lista
// je od v1.42 imala samo jedan segment po rezervaciji; ovo pravi realan `MockBookingItem` bez
// izmišljanja druge marže od one koja postoji (20% pretpostavljena samo kad nema drugog izvora,
// jasno obeleženo u komentaru koda, ne u UI-ju kao stvaran podatak).
function defaultItem(row: { bookingNumber: string; channel: MockBookingRow['channel']; productType: MockBookingRow['productType']; country: string; destinationCity: string; hotelName: string; accommodationType: string; totalPrice: number; currency: string }): MockBookingItem {
  const finalPrice = row.totalPrice;
  const baseCost = Math.round(finalPrice * 0.8);
  const marginAmount = finalPrice - baseCost;
  const marginPercent = Math.round((marginAmount / baseCost) * 1000) / 10;
  return {
    id: `${row.bookingNumber}-item-1`,
    sourceType: row.channel === 'MCP_AGENT' ? 'API' : 'CONTRACTED',
    productType: row.productType,
    country: row.country,
    destinationCity: row.destinationCity,
    hotelName: row.hotelName,
    roomType: row.accommodationType,
    serviceType: row.accommodationType,
    baseCost,
    marginPercent,
    marginAmount,
    finalPrice,
    currency: row.currency,
  };
}

const BRANCHES = ['Beograd — centrala', 'Novi Sad', 'Niš'];
const USERS = ['Marija Nikolić', 'Petar Stevanović', 'Ana Radulović'];

export const MOCK_BOOKINGS: MockBookingRow[] = [
  withDerived({ bookingNumber: 'TT-2026-100042', buyerName: 'Marko Petrović', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-07-10', stayTo: '2026-07-17', totalPrice: 89000, currency: 'EUR', createdAt: '2026-06-02', country: 'Grčka', destinationCity: 'Halkidiki', hotelName: 'Sani Beach Hotel', accommodationType: 'Dvokrevetna soba, All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Marko Petrović', ageCategory: 'ADULT' }, { name: 'Jovana Petrović', ageCategory: 'ADULT', birthYear: 1991 }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'Travelgate', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100043', buyerName: 'Ana Jovanović', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'PENDING_SUPPLIER_CONFIRMATION', paymentStatus: 'UNPAID', stayFrom: '2026-08-01', stayTo: '2026-08-08', totalPrice: 145000, currency: 'EUR', createdAt: '2026-06-03', country: 'Turska', destinationCity: 'Antalija', hotelName: 'Rixos Downtown', accommodationType: 'Porodična soba, All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Ana Jovanović', ageCategory: 'ADULT' }, { name: 'Petar Jovanović', ageCategory: 'ADULT' }, { name: 'Mila Jovanović', ageCategory: 'CHILD', birthYear: 2019 }], urgent: { reason: 'Rok za potvrdu dobavljača ističe za 24h — hotel još nije potvrdio dostupnost.' }, branch: 'Beograd — centrala', assignedUser: 'Petar Stevanović', supplierName: 'Solvex', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100044', buyerName: 'Nikolić Travel d.o.o.', buyerType: 'PRAVNO_LICE', channel: 'B2B_PORTAL', status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', stayFrom: '2026-06-20', stayTo: '2026-06-27', totalPrice: 320000, currency: 'EUR', createdAt: '2026-06-04', country: 'Egipat', destinationCity: 'Hurgada', hotelName: 'Steigenberger Aqua Magic', accommodationType: 'Dvokrevetna soba, All Inclusive', productType: 'PACKAGE', travelers: [{ name: 'Grupa 6 putnika (B2B)', ageCategory: 'ADULT' }], urgent: null, branch: 'Novi Sad', assignedUser: 'Ana Radulović', supplierName: 'WebHotelier', partnerName: 'Nikolić Travel d.o.o.' }),
  withDerived({ bookingNumber: 'TT-2026-100045', buyerName: 'Milica Stanković', buyerType: 'FIZICKO_LICE', channel: 'MOBILE', status: 'CANCELLED', paymentStatus: 'UNPAID', stayFrom: '2026-07-05', stayTo: '2026-07-09', totalPrice: 42000, currency: 'EUR', createdAt: '2026-06-05', country: 'Crna Gora', destinationCity: 'Budva', hotelName: 'Hotel Avala', accommodationType: 'Dvokrevetna soba, Noćenje sa doručkom', productType: 'ACCOMMODATION', travelers: [{ name: 'Milica Stanković', ageCategory: 'ADULT' }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'Travelgate', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100046', buyerName: 'Đorđe Ilić', buyerType: 'FIZICKO_LICE', channel: 'PHONE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-15', stayTo: '2026-06-22', totalPrice: 67000, currency: 'EUR', createdAt: '2026-06-06', country: 'Grčka', destinationCity: 'Krit', hotelName: 'Aldemar Royal Mare', accommodationType: 'Bungalov, Polupansion', productType: 'ACCOMMODATION', travelers: [{ name: 'Đorđe Ilić', ageCategory: 'ADULT' }, { name: 'Tijana Ilić', ageCategory: 'ADULT' }], urgent: { reason: 'Gost još nije uplatio depozit — rok istekao pre 2 dana.' }, branch: 'Niš', assignedUser: 'Petar Stevanović', supplierName: 'Solvex', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100047', buyerName: 'Jelena Radovanović', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'COMPLETED', paymentStatus: 'PAID', stayFrom: '2026-05-01', stayTo: '2026-05-08', totalPrice: 95000, currency: 'EUR', createdAt: '2026-04-02', country: 'Španija', destinationCity: 'Majorka', hotelName: 'Iberostar Playa de Muro', accommodationType: 'Dvokrevetna soba, All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Jelena Radovanović', ageCategory: 'ADULT' }, { name: 'Nikola Radovanović', ageCategory: 'ADULT' }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'Travelgate', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100048', buyerName: 'Stefan Pavlović', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-25', stayTo: '2026-07-02', totalPrice: 158000, currency: 'EUR', createdAt: '2026-06-08', country: 'Italija', destinationCity: 'Rimini', hotelName: 'Hotel Waldorf', accommodationType: 'Trokrevetna soba, Polupansion', productType: 'ACCOMMODATION', travelers: [{ name: 'Stefan Pavlović', ageCategory: 'ADULT' }, { name: 'Milica Pavlović', ageCategory: 'ADULT' }, { name: 'Luka Pavlović', ageCategory: 'CHILD', birthYear: 2021 }], urgent: { reason: 'Nedostaje potvrda ugovora sa klijentom (M20) pre polaska.' }, branch: 'Novi Sad', assignedUser: 'Ana Radulović', supplierName: 'WebHotelier', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100049', buyerName: 'Balkan Tours d.o.o.', buyerType: 'PRAVNO_LICE', channel: 'B2B_PORTAL', status: 'MODIFIED', paymentStatus: 'PARTIALLY_PAID', stayFrom: '2026-06-18', stayTo: '2026-06-25', totalPrice: 410000, currency: 'EUR', createdAt: '2026-06-09', country: 'Grčka', destinationCity: 'Tasos', hotelName: 'Alexandra Beach', accommodationType: 'Dvokrevetna soba, All Inclusive', productType: 'PACKAGE', travelers: [{ name: 'Grupa 8 putnika (B2B)', ageCategory: 'ADULT' }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'Travelgate', partnerName: 'Balkan Tours d.o.o.' }),
  withDerived({ bookingNumber: 'TT-2026-100050', buyerName: 'Vuk Nikolić', buyerType: 'FIZICKO_LICE', channel: 'MOBILE', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-08-10', stayTo: '2026-08-17', totalPrice: 112000, currency: 'EUR', createdAt: '2026-06-10', country: 'Grčka', destinationCity: 'Kasandra', hotelName: 'Alexander The Great', accommodationType: 'Dvokrevetna soba, All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Vuk Nikolić', ageCategory: 'ADULT' }, { name: 'Marija Nikolić', ageCategory: 'ADULT' }], urgent: null, branch: 'Niš', assignedUser: 'Petar Stevanović', supplierName: 'Solvex', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100051', buyerName: 'Ivana Đukić', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-30', stayTo: '2026-07-06', totalPrice: 76000, currency: 'EUR', createdAt: '2026-06-11', country: 'Crna Gora', destinationCity: 'Bečići', hotelName: 'Hotel Splendid', accommodationType: 'Dvokrevetna soba, Noćenje sa doručkom', productType: 'ACCOMMODATION', travelers: [{ name: 'Ivana Đukić', ageCategory: 'ADULT' }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'Travelgate', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100052', buyerName: 'Miloš Simić', buyerType: 'FIZICKO_LICE', channel: 'PHONE', status: 'CANCELLED', paymentStatus: 'UNPAID', stayFrom: '2026-07-15', stayTo: '2026-07-20', totalPrice: 53000, currency: 'EUR', createdAt: '2026-06-12', country: 'Albanija', destinationCity: 'Sarandë', hotelName: 'Bahamas Hotel', accommodationType: 'Dvokrevetna soba, Noćenje sa doručkom', productType: 'ACCOMMODATION', travelers: [{ name: 'Miloš Simić', ageCategory: 'ADULT' }], urgent: null, branch: 'Niš', assignedUser: 'Petar Stevanović', supplierName: 'WebHotelier', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100053', buyerName: 'Teodora Mitrović', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'PENDING_SUPPLIER_CONFIRMATION', paymentStatus: 'UNPAID', stayFrom: '2026-08-20', stayTo: '2026-08-27', totalPrice: 189000, currency: 'EUR', createdAt: '2026-06-13', country: 'Turska', destinationCity: 'Bodrum', hotelName: 'Voyage Bodrum', accommodationType: 'Dvokrevetna soba, Ultra All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Teodora Mitrović', ageCategory: 'ADULT' }, { name: 'Aleksa Mitrović', ageCategory: 'BABY', birthYear: 2025 }], urgent: { reason: 'Rok za potvrdu dobavljača ističe za 24h.' }, branch: 'Novi Sad', assignedUser: 'Ana Radulović', supplierName: 'Solvex', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100054', buyerName: 'Aleksandar Kostić', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-06-22', stayTo: '2026-06-29', totalPrice: 98000, currency: 'EUR', createdAt: '2026-06-14', country: 'Grčka', destinationCity: 'Paralija', hotelName: 'Mediterranean Village', accommodationType: 'Dvokrevetna soba, Polupansion', productType: 'ACCOMMODATION', travelers: [{ name: 'Aleksandar Kostić', ageCategory: 'ADULT' }, { name: 'Ksenija Kostić', ageCategory: 'ADULT' }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'Travelgate', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100055', buyerName: 'Sunrise Agencija d.o.o.', buyerType: 'PRAVNO_LICE', channel: 'B2B_PORTAL', status: 'CONFIRMED', paymentStatus: 'INVOICE_PENDING', stayFrom: '2026-07-01', stayTo: '2026-07-14', totalPrice: 560000, currency: 'EUR', createdAt: '2026-06-15', country: 'Grčka', destinationCity: 'Krf', hotelName: 'Grecotel Corfu Imperial', accommodationType: 'Apartman, All Inclusive', productType: 'PACKAGE', travelers: [{ name: 'Grupa 10 putnika (B2B)', ageCategory: 'ADULT' }], urgent: { reason: 'Faktura još nije poslata nalogodavcu (INVOICE_PENDING preko roka).' }, branch: 'Novi Sad', assignedUser: 'Ana Radulović', supplierName: 'WebHotelier', partnerName: 'Sunrise Agencija d.o.o.' }),
  withDerived({ bookingNumber: 'TT-2026-100056', buyerName: 'Nataša Popović', buyerType: 'FIZICKO_LICE', channel: 'MOBILE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-08-05', stayTo: '2026-08-12', totalPrice: 121000, currency: 'EUR', createdAt: '2026-06-16', country: 'Bugarska', destinationCity: 'Sunčev Breg', hotelName: 'Hotel Marina Grand Beach', accommodationType: 'Dvokrevetna soba, All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Nataša Popović', ageCategory: 'ADULT' }, { name: 'Miloš Popović', ageCategory: 'ADULT' }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'Solvex', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100057', buyerName: 'Filip Đorđević', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'COMPLETED', paymentStatus: 'PAID', stayFrom: '2026-05-10', stayTo: '2026-05-15', totalPrice: 64000, currency: 'EUR', createdAt: '2026-04-11', country: 'Crna Gora', destinationCity: 'Petrovac', hotelName: 'Hotel Palas', accommodationType: 'Dvokrevetna soba, Noćenje sa doručkom', productType: 'ACCOMMODATION', travelers: [{ name: 'Filip Đorđević', ageCategory: 'ADULT' }], urgent: null, branch: 'Niš', assignedUser: 'Petar Stevanović', supplierName: 'Travelgate', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100058', buyerName: 'Katarina Vasić', buyerType: 'FIZICKO_LICE', channel: 'INTERNAL_PANEL', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-28', stayTo: '2026-07-03', totalPrice: 87000, currency: 'EUR', createdAt: '2026-06-17', country: 'Grčka', destinationCity: 'Nea Kalikratija', hotelName: 'Athos Palace', accommodationType: 'Dvokrevetna soba, Polupansion', productType: 'ACCOMMODATION', travelers: [{ name: 'Katarina Vasić', ageCategory: 'ADULT' }, { name: 'Ognjen Vasić', ageCategory: 'CHILD', birthYear: 2017 }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'Marija Nikolić', supplierName: 'WebHotelier', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100059', buyerName: 'AI Agent (MCP)', buyerType: 'PRAVNO_LICE', channel: 'MCP_AGENT', status: 'CONFIRMED', paymentStatus: 'PAID', stayFrom: '2026-07-20', stayTo: '2026-07-27', totalPrice: 203000, currency: 'EUR', createdAt: '2026-06-18', country: 'Grčka', destinationCity: 'Sitonija', hotelName: 'Danai Beach Resort', accommodationType: 'Vila, All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Rezervacija preko MCP agenta — putnici nepoznati', ageCategory: 'ADULT' }], urgent: null, branch: 'Beograd — centrala', assignedUser: 'sistem (MCP)', supplierName: 'Travelgate', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100060', buyerName: 'Dušan Lazić', buyerType: 'FIZICKO_LICE', channel: 'PHONE', status: 'MODIFIED', paymentStatus: 'PARTIALLY_PAID', stayFrom: '2026-08-15', stayTo: '2026-08-22', totalPrice: 134000, currency: 'EUR', createdAt: '2026-06-19', country: 'Turska', destinationCity: 'Marmaris', hotelName: 'Hilton Dedeman', accommodationType: 'Dvokrevetna soba, All Inclusive', productType: 'ACCOMMODATION', travelers: [{ name: 'Dušan Lazić', ageCategory: 'ADULT' }, { name: 'Bojana Lazić', ageCategory: 'ADULT' }], urgent: null, branch: 'Novi Sad', assignedUser: 'Ana Radulović', supplierName: 'Solvex', partnerName: null }),
  withDerived({ bookingNumber: 'TT-2026-100061', buyerName: 'Marija Todorović', buyerType: 'FIZICKO_LICE', channel: 'B2C_SITE', status: 'CONFIRMED', paymentStatus: 'UNPAID', stayFrom: '2026-06-24', stayTo: '2026-06-30', totalPrice: 71000, currency: 'EUR', createdAt: '2026-06-20', country: 'Crna Gora', destinationCity: 'Herceg Novi', hotelName: 'Hotel Plaža', accommodationType: 'Dvokrevetna soba, Noćenje sa doručkom', productType: 'ACCOMMODATION', travelers: [{ name: 'Marija Todorović', ageCategory: 'ADULT' }], urgent: { reason: 'Rok za uplatu ostatka ističe sutra.' }, branch: 'Niš', assignedUser: 'Petar Stevanović', supplierName: 'Travelgate', partnerName: null }),
];

export { BRANCHES, USERS };

// Izmišljen (ali realan-oblik) tok, samo za MOCK prikaz (23.8.2026) — pravi tok ide preko
// stvarnog GET /sales/bookings/:id/history (M5 spec §11 dopuna, isti dan) čim ova lista dobije
// stvarne ID-jeve iz baze umesto izmišljenih brojeva rezervacija. Premešteno ovde (23.8.2026,
// dopuna "pun zapis") — deljeno između `BookingsTable.tsx` (ikonica u redu) i `[bookingNumber]/
// page.tsx` (dugme u punom zapisu), jedan izvor umesto dva primerka iste logike.
export interface TimelineEntry {
  timestamp: string;
  action: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  actorName: string;
}

export function buildMockTimeline(b: MockBookingRow): TimelineEntry[] {
  const created = new Date(b.createdAt);
  const plusDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
  const entries: TimelineEntry[] = [
    { timestamp: created.toISOString(), action: 'booking.pending_supplier_confirmation', actorType: 'HUMAN', actorName: 'Marija Nikolić (prodaja)' },
  ];
  if (b.status !== 'PENDING_SUPPLIER_CONFIRMATION') {
    entries.push({ timestamp: plusDays(created, 1).toISOString(), action: 'booking.confirmed', actorType: 'AI_AGENT', actorName: 'SupplierConfirmationAgent' });
  }
  if (b.status === 'MODIFIED') {
    entries.push({ timestamp: plusDays(created, 3).toISOString(), action: 'booking.modified', actorType: 'HUMAN', actorName: 'Marija Nikolić (prodaja)' });
  }
  if (b.status === 'CANCELLED') {
    entries.push({ timestamp: plusDays(created, 2).toISOString(), action: 'booking.cancelled', actorType: 'HUMAN', actorName: 'Nenad Tomić (vlasnik)' });
  }
  if (b.paymentStatus === 'PAID' || b.paymentStatus === 'PARTIALLY_PAID') {
    entries.push({ timestamp: plusDays(created, 4).toISOString(), action: 'payment.recorded', actorType: 'SYSTEM', actorName: 'sistem (uplata evidentirana)' });
  }
  if (b.status === 'COMPLETED') {
    entries.push({ timestamp: b.stayTo, action: 'booking.completed', actorType: 'SYSTEM', actorName: 'sistem (datum povratka prošao)' });
  }
  return entries;
}
