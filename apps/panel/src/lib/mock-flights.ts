// Podaci mock rezultata letova + filteri nad njima (M5 spec §3.0d.1).
//
// Zašto su podaci ovde a ne u samoj komponenti prikaza: filteri žive u LEVOM panelu
// (SearchSidebarPanel.tsx), a rezultati u centralnom (FlightResultsMock.tsx) — a spec §3.0c.2
// tačka 3 traži da se u filteru nude SAMO vrednosti koje se stvarno pojavljuju u rezultatima
// (nikad prazna opcija koja ništa ne vraća). Da bi oba mesta gledala isti spisak, spisak mora
// biti na trećem, zajedničkom mestu.
//
// MOCK — kad M4 dobije stvaran avio/GDS adapter, ovaj fajl se zamenjuje pravim odgovorom;
// tada se spiskovi opcija (`airlineOptions`/`connectionAirportOptions`) izvode iz stvarnih
// rezultata pretrage, bez izmene same logike filtriranja ispod.

export interface MockFlight {
  id: string;
  airline: string;
  flightNumber: string;
  fromCity: string;
  fromCode: string;
  toCity: string;
  toCode: string;
  departTime: string;
  arriveTime: string;
  durationLabel: string;
  /** Ukupno trajanje puta u minutima — filter "najduže trajanje" (§3.0d.1). */
  durationMinutes: number;
  stops: number;
  /** IATA kod aerodroma presedanja; `null` za direktan let (§3.0d.1 "izbor aerodroma presedanja"). */
  connectionAirport: string | null;
  /** Čekanje na presedanju u minutima; `null` za direktan let (§3.0d.1 "maksimalno vreme čekanja"). */
  layoverMinutes: number | null;
  /** §3.0d.1 "broj uključenog ručnog/predatog prtljaga". */
  carryOnIncluded: boolean;
  checkedBagsIncluded: number;
  cabinClass: string;
  price: number;
  currency: string;
}

export const MOCK_FLIGHTS: MockFlight[] = [
  {
    id: 'mock-f1', airline: 'Air Serbia', flightNumber: 'JU 322',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '07:15', arriveTime: '09:05', durationLabel: '1h 50min', durationMinutes: 110,
    stops: 0, connectionAirport: null, layoverMinutes: null,
    carryOnIncluded: true, checkedBagsIncluded: 1, cabinClass: 'ECONOMY', price: 18900, currency: 'EUR',
  },
  {
    id: 'mock-f2', airline: 'Aegean Airlines', flightNumber: 'A3 812',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '13:40', arriveTime: '15:35', durationLabel: '1h 55min', durationMinutes: 115,
    stops: 0, connectionAirport: null, layoverMinutes: null,
    carryOnIncluded: true, checkedBagsIncluded: 1, cabinClass: 'ECONOMY', price: 16700, currency: 'EUR',
  },
  {
    id: 'mock-f3', airline: 'Wizz Air', flightNumber: 'W6 4301',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '19:20', arriveTime: '23:10', durationLabel: '3h 50min', durationMinutes: 230,
    stops: 1, connectionAirport: 'BUD', layoverMinutes: 65,
    carryOnIncluded: true, checkedBagsIncluded: 0, cabinClass: 'ECONOMY', price: 9900, currency: 'EUR',
  },
  {
    id: 'mock-f4', airline: 'Air Serbia', flightNumber: 'JU 322',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '07:15', arriveTime: '09:05', durationLabel: '1h 50min', durationMinutes: 110,
    stops: 0, connectionAirport: null, layoverMinutes: null,
    carryOnIncluded: true, checkedBagsIncluded: 2, cabinClass: 'BUSINESS', price: 42300, currency: 'EUR',
  },
  {
    id: 'mock-f5', airline: 'Lufthansa', flightNumber: 'LH 1727',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '06:05', arriveTime: '12:40', durationLabel: '6h 35min', durationMinutes: 395,
    stops: 1, connectionAirport: 'MUC', layoverMinutes: 195,
    carryOnIncluded: true, checkedBagsIncluded: 1, cabinClass: 'ECONOMY', price: 21400, currency: 'EUR',
  },
  {
    id: 'mock-f6', airline: 'Turkish Airlines', flightNumber: 'TK 1080',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '11:25', arriveTime: '18:15', durationLabel: '6h 50min', durationMinutes: 410,
    stops: 1, connectionAirport: 'IST', layoverMinutes: 140,
    carryOnIncluded: true, checkedBagsIncluded: 1, cabinClass: 'ECONOMY', price: 19600, currency: 'EUR',
  },
  {
    id: 'mock-f7', airline: 'Wizz Air', flightNumber: 'W6 4188',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '05:40', arriveTime: '14:55', durationLabel: '9h 15min', durationMinutes: 555,
    stops: 2, connectionAirport: 'BUD', layoverMinutes: 310,
    carryOnIncluded: true, checkedBagsIncluded: 0, cabinClass: 'ECONOMY', price: 8400, currency: 'EUR',
  },
  {
    id: 'mock-f8', airline: 'Aegean Airlines', flightNumber: 'A3 856',
    fromCity: 'Beograd', fromCode: 'BEG', toCity: 'Atina', toCode: 'ATH',
    departTime: '21:50', arriveTime: '23:45', durationLabel: '1h 55min', durationMinutes: 115,
    stops: 0, connectionAirport: null, layoverMinutes: null,
    carryOnIncluded: true, checkedBagsIncluded: 0, cabinClass: 'PREMIUM_ECONOMY', price: 27300, currency: 'EUR',
  },
];

/** "07:15" → 435 (minuti od ponoći). Za filtere opsega vremena poletanja/sletanja. */
export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Avio-kompanije koje se stvarno pojavljuju u rezultatima (§3.0c.2 tačka 3). */
export const airlineOptions: string[] = Array.from(new Set(MOCK_FLIGHTS.map((f) => f.airline))).sort();

/** Aerodromi presedanja koji se stvarno pojavljuju u rezultatima. */
export const connectionAirportOptions: string[] = Array.from(
  new Set(MOCK_FLIGHTS.map((f) => f.connectionAirport).filter((a): a is string => Boolean(a)))
).sort();

/** Filteri letova iz M5 spec §3.0d.1 — svi klijentski, nad već dobijenim rezultatima. */
export interface FlightFilterValues {
  /** 'DIRECT' = bez presedanja, 'MAX1' = najviše jedno, null = svejedno. */
  stops: 'DIRECT' | 'MAX1' | null;
  airlines: string[];
  connectionAirports: string[];
  /** Minuti; gornja granica čekanja na presedanju. */
  maxLayoverMinutes: number | null;
  /** Minuti; gornja granica ukupnog trajanja puta. */
  maxDurationMinutes: number | null;
  /** "HH:MM" opseg poletanja / sletanja. */
  departFrom: string | null;
  departTo: string | null;
  arriveFrom: string | null;
  arriveTo: string | null;
  /** Traži bar toliko komada predatog prtljaga uključenog u cenu. */
  minCheckedBags: number | null;
}

export function flightFiltersFromParams(
  get: (k: string) => string | null,
  getAll: (k: string) => string[]
): FlightFilterValues {
  const num = (k: string) => {
    const v = get(k);
    return v && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  const stops = get('stops');
  return {
    stops: stops === 'DIRECT' || stops === 'MAX1' ? stops : null,
    airlines: getAll('airlines'),
    connectionAirports: getAll('connAirports'),
    maxLayoverMinutes: num('maxLayover'),
    maxDurationMinutes: num('maxDuration'),
    departFrom: get('departFrom'),
    departTo: get('departTo'),
    arriveFrom: get('arriveFrom'),
    arriveTo: get('arriveTo'),
    minCheckedBags: num('minCheckedBags'),
  };
}

export function applyFlightFilters(flights: MockFlight[], f: FlightFilterValues): MockFlight[] {
  return flights.filter((x) => {
    if (f.stops === 'DIRECT' && x.stops !== 0) return false;
    if (f.stops === 'MAX1' && x.stops > 1) return false;
    if (f.airlines.length > 0 && !f.airlines.includes(x.airline)) return false;
    // Aerodrom presedanja se primenjuje SAMO na letove koji stvarno presedaju — direktan let
    // nije loš izbor zato što ne prolazi kroz izabrani aerodrom, on je bolji od svakog sa
    // presedanjem. Izbacivanje direktnih letova ovim filterom bilo bi protiv namere korisnika.
    if (f.connectionAirports.length > 0 && x.connectionAirport && !f.connectionAirports.includes(x.connectionAirport)) return false;
    if (f.maxLayoverMinutes != null && x.layoverMinutes != null && x.layoverMinutes > f.maxLayoverMinutes) return false;
    if (f.maxDurationMinutes != null && x.durationMinutes > f.maxDurationMinutes) return false;
    if (f.departFrom && minutesOfDay(x.departTime) < minutesOfDay(f.departFrom)) return false;
    if (f.departTo && minutesOfDay(x.departTime) > minutesOfDay(f.departTo)) return false;
    if (f.arriveFrom && minutesOfDay(x.arriveTime) < minutesOfDay(f.arriveFrom)) return false;
    if (f.arriveTo && minutesOfDay(x.arriveTime) > minutesOfDay(f.arriveTo)) return false;
    if (f.minCheckedBags != null && x.checkedBagsIncluded < f.minCheckedBags) return false;
    return true;
  });
}
