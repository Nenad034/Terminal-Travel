/**
 * MOCK KATALOG DESTINACIJA — samo za lokalni razvoj, nikad za produkciju.
 *
 * Zašto postoji (zahtev vlasnika, 3.9.2026): prediktivno kucanje u pretrazi (M5 §3.0c.2) ne
 * čita nikakvu posebnu „bazu država i mesta" — `GET /sales/search/countries` i `/destinations`
 * grupišu `Product.destination_country`/`destination_city` nad ACTIVE katalogom. Sa četiri
 * aktivna proizvoda u lokalnoj bazi, polje za državu nudi dve stavke i pretraga deluje
 * pokvareno iako radi tačno kako je specificirana. Ovo puni katalog dovoljno gustom mrežom
 * destinacija da se pretraga, mapa i predlozi mogu videti onako kako će izgledati u radu.
 *
 * Šta pravi (sve `ACTIVE`, vidljivo i na `B2C_SITE` i u panelu):
 *   - jedan dobavljač po državi (M3), sa maržom na nivou dobavljača (M5 §2.1 traži pravilo u
 *     lancu, inače pravljenje Ponude pada),
 *   - jedan ugovor PO SMEŠTAJU, sa tri perioda (leto 2026, vansezona, leto 2027) i cenama po
 *     tipu usluge — bez ugovora `GET /search` ne vraća nijednu ponudu i proizvod ispada iz
 *     rezultata (M5 §3.0b.2), pa bi katalog bio pun a pretraga prazna,
 *   - `ACCOMMODATION` po destinaciji, `FLIGHT` (jedna noga = jedan proizvod, M2 §2.3) i
 *     `TRANSFER` (aerodrom → mesto) sa `attributes.route.origin_city`/`destination_city`.
 *
 * Koordinate se OVDE NE UPISUJU. Vlasnikova odluka 2.9.2026 (M5 §3.0h.1) je da se izvode
 * automatski iz adrese, pa se posle ove skripte pokreće `npm run geocode:products` — isti put
 * kojim su prošli i postojeći proizvodi. Ručno prekucane koordinate bi bile drugi izvor
 * istine za isti podatak.
 *
 * SVE što skripta napravi nosi `MOCK_MARKER` u nazivu dobavljača i broju ugovora, i `MOCK_SLUG`
 * u slug-u prevoda, pa `mock-destinacije-clean.ts` briše tačno to i ništa drugo. Postojeći
 * `seed.ts` i `mock-b2c.ts` se ne diraju — ovo je dodatak, ne zamena.
 *
 * Pokretanje iz `apps/api`:
 *   npm run seed:mock-destinacije
 *   npm run seed:mock-destinacije:clean
 */
import { PrismaClient, LanguageCode } from '@prisma/client';

const prisma = new PrismaClient();

export const MOCK_MARKER = 'MOCK-DEST';
/** Sufiks u slug-u prevoda — jedini trag mock-a na samom proizvodu (naziv hotela ostaje čist). */
export const MOCK_SLUG = 'mock-dest';

/** Cene su u najmanjoj jedinici valute ugovora (EUR centi), konvencija M3 `RateLine.price`. */
const eur = (amount: number) => Math.round(amount * 100);

type Board = 'BB' | 'HB' | 'FB' | 'AI';

interface Destinacija {
  city: string;
  /** Naziv hotela — bez „mock" u imenu, da ekran izgleda kao stvaran katalog. */
  hotel: string;
  /** Kategorija u zvezdicama, ide u `attributes.category`. */
  stars: number;
  /** Cena dvokrevetne sobe po noći u letnjoj sezoni, EUR — ostale se izvode iz nje. */
  price: number;
  /** Tipovi usluge koje ovaj objekat nudi; prvi je osnovni. */
  boards: Board[];
  /** `attributes.amenities[]` — kontrolisana taksonomija, M2 §2.3c (`AmenityTag`). */
  amenities: string[];
  /** Aerodrom preko kog se dolazi — koristi se za TRANSFER i FLIGHT proizvode. */
  airport?: string;
}

interface Drzava {
  country: string;
  /** Naziv mock dobavljača za tu državu. */
  supplier: string;
  destinacije: Destinacija[];
}

const MORE = ['WIFI_FREE', 'POOL_OUTDOOR', 'RESTAURANT', 'PARKING', 'SEA_VIEW'];
const MORE_PORODICNO = [...MORE, 'POOL_KIDS', 'FAMILY_FRIENDLY', 'BEACH_SAND'];
const PLANINA = ['WIFI_FREE', 'RESTAURANT', 'PARKING', 'SPA_WELLNESS', 'MOUNTAIN_VIEW'];
const GRAD = ['WIFI_FREE', 'RESTAURANT', 'PARKING', 'NON_SMOKING', 'ROOM_SERVICE'];

const KATALOG: Drzava[] = [
  {
    country: 'Grčka',
    supplier: 'Elliniko Travel DMC',
    destinacije: [
      { city: 'Sitonija', hotel: 'Blue Horizon Sithonia', stars: 4, price: 96, boards: ['HB', 'BB', 'FB'], amenities: [...MORE_PORODICNO, 'BEACH_PEBBLE'], airport: 'Solun' },
      { city: 'Kasandra', hotel: 'Aegean Breeze Resort', stars: 4, price: 88, boards: ['HB', 'BB', 'AI'], amenities: MORE_PORODICNO, airport: 'Solun' },
      { city: 'Solun', hotel: 'Thessaloniki City Hotel', stars: 4, price: 74, boards: ['BB'], amenities: GRAD, airport: 'Solun' },
      { city: 'Krf', hotel: 'Corfu Palm Beach', stars: 4, price: 102, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Krf' },
      { city: 'Rodos', hotel: 'Rhodes Sun Village', stars: 5, price: 138, boards: ['AI', 'HB'], amenities: [...MORE_PORODICNO, 'SPA_WELLNESS', 'GYM'], airport: 'Rodos' },
      { city: 'Krit', hotel: 'Creta Blue Bay', stars: 5, price: 145, boards: ['AI', 'HB'], amenities: [...MORE_PORODICNO, 'SPA_WELLNESS'], airport: 'Iraklion' },
      { city: 'Zakintos', hotel: 'Zante Coral Bay', stars: 4, price: 108, boards: ['HB', 'BB'], amenities: MORE, airport: 'Zakintos' },
      { city: 'Tasos', hotel: 'Thassos Olive Garden', stars: 3, price: 62, boards: ['BB', 'HB'], amenities: MORE, airport: 'Kavala' },
      { city: 'Parga', hotel: 'Parga Riviera', stars: 4, price: 92, boards: ['HB', 'BB'], amenities: MORE, airport: 'Preveza' },
      { city: 'Atina', hotel: 'Athens Acropolis View', stars: 4, price: 96, boards: ['BB'], amenities: GRAD, airport: 'Atina' },
    ],
  },
  {
    country: 'Turska',
    supplier: 'Anadolu Incoming',
    destinacije: [
      { city: 'Antalija', hotel: 'Lara Grand Resort', stars: 5, price: 152, boards: ['AI', 'FB'], amenities: [...MORE_PORODICNO, 'SPA_WELLNESS', 'GYM', 'BEACH_PRIVATE'], airport: 'Antalija' },
      { city: 'Kemer', hotel: 'Kemer Pine Bay', stars: 5, price: 134, boards: ['AI'], amenities: [...MORE_PORODICNO, 'BEACH_PEBBLE', 'SPA_WELLNESS'], airport: 'Antalija' },
      { city: 'Side', hotel: 'Side Ancient Resort', stars: 5, price: 128, boards: ['AI'], amenities: MORE_PORODICNO, airport: 'Antalija' },
      { city: 'Alanja', hotel: 'Alanya Cleopatra Beach', stars: 4, price: 98, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Gazipaša' },
      { city: 'Bodrum', hotel: 'Bodrum Marina Suites', stars: 5, price: 164, boards: ['HB', 'BB'], amenities: [...MORE, 'ADULTS_ONLY', 'SPA_WELLNESS'], airport: 'Bodrum' },
      { city: 'Marmaris', hotel: 'Marmaris Blue Lagoon', stars: 4, price: 104, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Dalaman' },
      { city: 'Istanbul', hotel: 'Istanbul Old City Hotel', stars: 4, price: 86, boards: ['BB'], amenities: GRAD, airport: 'Istanbul' },
    ],
  },
  {
    country: 'Crna Gora',
    supplier: 'Primorje Turs',
    destinacije: [
      { city: 'Budva', hotel: 'Budva Riviera Hotel', stars: 4, price: 112, boards: ['HB', 'BB'], amenities: [...MORE, 'BEACH_PEBBLE'], airport: 'Tivat' },
      { city: 'Bečići', hotel: 'Bečići Sunset Resort', stars: 4, price: 118, boards: ['HB', 'AI'], amenities: MORE_PORODICNO, airport: 'Tivat' },
      { city: 'Petrovac', hotel: 'Petrovac Bay Hotel', stars: 3, price: 78, boards: ['BB', 'HB'], amenities: MORE, airport: 'Tivat' },
      { city: 'Herceg Novi', hotel: 'Herceg Novi Spa Hotel', stars: 4, price: 96, boards: ['HB'], amenities: [...MORE, 'SPA_WELLNESS'], airport: 'Tivat' },
      { city: 'Kotor', hotel: 'Kotor Old Town Rooms', stars: 3, price: 82, boards: ['BB'], amenities: GRAD, airport: 'Tivat' },
      { city: 'Ulcinj', hotel: 'Ulcinj Long Beach Resort', stars: 4, price: 88, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Podgorica' },
      { city: 'Žabljak', hotel: 'Durmitor Mountain Lodge', stars: 3, price: 68, boards: ['HB', 'BB'], amenities: PLANINA, airport: 'Podgorica' },
    ],
  },
  {
    country: 'Srbija',
    supplier: 'Domaći Aranžmani',
    destinacije: [
      { city: 'Zlatibor', hotel: 'Zlatibor Vista Hotel', stars: 4, price: 74, boards: ['HB', 'FB'], amenities: [...PLANINA, 'POOL_INDOOR'] },
      { city: 'Kopaonik', hotel: 'Kopaonik Ski Resort', stars: 4, price: 92, boards: ['HB', 'FB'], amenities: [...PLANINA, 'POOL_HEATED'] },
      { city: 'Vrnjačka Banja', hotel: 'Vrnjci Spa Hotel', stars: 4, price: 66, boards: ['FB', 'HB'], amenities: [...PLANINA, 'POOL_INDOOR'] },
      { city: 'Sokobanja', hotel: 'Sokobanja Wellness', stars: 3, price: 54, boards: ['FB', 'HB'], amenities: PLANINA },
      { city: 'Tara', hotel: 'Tara Forest Lodge', stars: 3, price: 58, boards: ['HB'], amenities: PLANINA },
      { city: 'Beograd', hotel: 'Beograd Centar Hotel', stars: 4, price: 84, boards: ['BB'], amenities: GRAD, airport: 'Beograd' },
      { city: 'Novi Sad', hotel: 'Novi Sad Danube Hotel', stars: 4, price: 72, boards: ['BB'], amenities: GRAD },
    ],
  },
  {
    country: 'Egipat',
    supplier: 'Nile Incoming Services',
    destinacije: [
      { city: 'Hurgada', hotel: 'Hurghada Coral Reef Resort', stars: 5, price: 118, boards: ['AI'], amenities: [...MORE_PORODICNO, 'SPA_WELLNESS', 'BEACH_PRIVATE'], airport: 'Hurgada' },
      { city: 'Šarm el Šeik', hotel: 'Sharm Bay Resort', stars: 5, price: 126, boards: ['AI'], amenities: [...MORE_PORODICNO, 'BEACH_ROCK', 'SPA_WELLNESS'], airport: 'Šarm el Šeik' },
      { city: 'Marsa Alam', hotel: 'Marsa Alam Diving Resort', stars: 4, price: 104, boards: ['AI'], amenities: MORE_PORODICNO, airport: 'Marsa Alam' },
      { city: 'Kairo', hotel: 'Cairo Pyramids View', stars: 4, price: 78, boards: ['BB'], amenities: GRAD, airport: 'Kairo' },
    ],
  },
  {
    country: 'Španija',
    supplier: 'Iberia Destinos',
    destinacije: [
      { city: 'Barselona', hotel: 'Barcelona Rambla Hotel', stars: 4, price: 128, boards: ['BB'], amenities: GRAD, airport: 'Barselona' },
      { city: 'Madrid', hotel: 'Madrid Gran Via Hotel', stars: 4, price: 122, boards: ['BB'], amenities: GRAD, airport: 'Madrid' },
      { city: 'Malaga', hotel: 'Costa del Sol Beach Hotel', stars: 4, price: 116, boards: ['HB', 'BB'], amenities: MORE_PORODICNO, airport: 'Malaga' },
      { city: 'Palma de Majorka', hotel: 'Mallorca Palma Bay', stars: 4, price: 132, boards: ['HB', 'AI'], amenities: MORE_PORODICNO, airport: 'Palma de Majorka' },
      { city: 'Tenerife', hotel: 'Tenerife Atlantic Resort', stars: 4, price: 138, boards: ['AI', 'HB'], amenities: [...MORE_PORODICNO, 'BEACH_ROCK'], airport: 'Tenerife' },
    ],
  },
  {
    country: 'Italija',
    supplier: 'Bel Paese Tours',
    destinacije: [
      { city: 'Rim', hotel: 'Roma Termini Hotel', stars: 3, price: 92, boards: ['BB'], amenities: GRAD, airport: 'Rim' },
      { city: 'Milano', hotel: 'Milano Duomo Hotel', stars: 4, price: 124, boards: ['BB'], amenities: GRAD, airport: 'Milano' },
      { city: 'Venecija', hotel: 'Venezia Mestre Hotel', stars: 3, price: 96, boards: ['BB'], amenities: GRAD, airport: 'Venecija' },
      { city: 'Napulj', hotel: 'Napoli Centrale Hotel', stars: 3, price: 84, boards: ['BB'], amenities: GRAD, airport: 'Napulj' },
      { city: 'Rimini', hotel: 'Rimini Adriatic Beach', stars: 4, price: 98, boards: ['HB', 'FB'], amenities: MORE_PORODICNO, airport: 'Bolonja' },
      { city: 'Firenca', hotel: 'Firenze Arno Hotel', stars: 4, price: 118, boards: ['BB'], amenities: GRAD, airport: 'Firenca' },
    ],
  },
  {
    country: 'Hrvatska',
    supplier: 'Jadran Adriatic',
    destinacije: [
      { city: 'Dubrovnik', hotel: 'Dubrovnik Old Port Hotel', stars: 4, price: 156, boards: ['BB', 'HB'], amenities: [...MORE, 'BEACH_ROCK'], airport: 'Dubrovnik' },
      { city: 'Split', hotel: 'Split Riva Hotel', stars: 4, price: 128, boards: ['BB'], amenities: GRAD, airport: 'Split' },
      { city: 'Makarska', hotel: 'Makarska Pine Beach', stars: 4, price: 112, boards: ['HB', 'BB'], amenities: [...MORE, 'BEACH_PEBBLE'], airport: 'Split' },
      { city: 'Poreč', hotel: 'Poreč Istria Resort', stars: 4, price: 104, boards: ['HB', 'AI'], amenities: MORE_PORODICNO, airport: 'Pula' },
      { city: 'Zadar', hotel: 'Zadar Sunset Hotel', stars: 3, price: 88, boards: ['BB', 'HB'], amenities: MORE, airport: 'Zadar' },
    ],
  },
  {
    country: 'Bugarska',
    supplier: 'Bulgaria Holidays',
    destinacije: [
      { city: 'Sunčev breg', hotel: 'Sunny Beach Grand', stars: 4, price: 82, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Burgas' },
      { city: 'Zlatni pjasci', hotel: 'Golden Sands Resort', stars: 4, price: 86, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Varna' },
      { city: 'Bansko', hotel: 'Bansko Ski Lodge', stars: 4, price: 72, boards: ['HB', 'FB'], amenities: [...PLANINA, 'POOL_INDOOR'], airport: 'Sofija' },
      { city: 'Sofija', hotel: 'Sofia City Center', stars: 4, price: 68, boards: ['BB'], amenities: GRAD, airport: 'Sofija' },
    ],
  },
  {
    country: 'Albanija',
    supplier: 'Albania Coast DMC',
    destinacije: [
      { city: 'Drač', hotel: 'Durrës Beach Hotel', stars: 4, price: 74, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Tirana' },
      { city: 'Saranda', hotel: 'Saranda Ionian View', stars: 4, price: 86, boards: ['HB', 'BB'], amenities: MORE, airport: 'Tirana' },
      { city: 'Valona', hotel: 'Vlorë Riviera Hotel', stars: 3, price: 66, boards: ['BB', 'HB'], amenities: MORE, airport: 'Tirana' },
      { city: 'Tirana', hotel: 'Tirana Skanderbeg Hotel', stars: 4, price: 64, boards: ['BB'], amenities: GRAD, airport: 'Tirana' },
    ],
  },
  {
    country: 'Tunis',
    supplier: 'Carthage Travel',
    destinacije: [
      { city: 'Hamamet', hotel: 'Hammamet Yasmine Resort', stars: 4, price: 88, boards: ['AI'], amenities: MORE_PORODICNO, airport: 'Enfida' },
      { city: 'Suse', hotel: 'Sousse Medina Beach', stars: 4, price: 82, boards: ['AI'], amenities: MORE_PORODICNO, airport: 'Monastir' },
      { city: 'Đerba', hotel: 'Djerba Island Resort', stars: 5, price: 106, boards: ['AI'], amenities: [...MORE_PORODICNO, 'SPA_WELLNESS'], airport: 'Đerba' },
    ],
  },
  {
    country: 'Ujedinjeni Arapski Emirati',
    supplier: 'Gulf Premium DMC',
    destinacije: [
      { city: 'Dubai', hotel: 'Dubai Marina Tower Hotel', stars: 5, price: 186, boards: ['BB', 'HB'], amenities: [...MORE, 'GYM', 'SPA_WELLNESS', 'BEACH_PRIVATE'], airport: 'Dubai' },
      { city: 'Abu Dabi', hotel: 'Abu Dhabi Corniche Hotel', stars: 5, price: 168, boards: ['BB', 'HB'], amenities: [...MORE, 'GYM', 'SPA_WELLNESS'], airport: 'Abu Dabi' },
      { city: 'Šardža', hotel: 'Sharjah Beach Resort', stars: 4, price: 112, boards: ['HB', 'AI'], amenities: MORE_PORODICNO, airport: 'Dubai' },
    ],
  },
  {
    country: 'Kipar',
    supplier: 'Cyprus Sun Travel',
    destinacije: [
      { city: 'Ajia Napa', hotel: 'Ayia Napa Nissi Resort', stars: 4, price: 124, boards: ['AI', 'HB'], amenities: MORE_PORODICNO, airport: 'Larnaka' },
      { city: 'Larnaka', hotel: 'Larnaca Palm Beach', stars: 4, price: 108, boards: ['HB', 'BB'], amenities: MORE, airport: 'Larnaka' },
      { city: 'Pafos', hotel: 'Paphos Coral Hotel', stars: 4, price: 116, boards: ['HB', 'AI'], amenities: MORE_PORODICNO, airport: 'Pafos' },
    ],
  },
  {
    country: 'Malta',
    supplier: 'Malta Island Tours',
    destinacije: [
      { city: 'Sliema', hotel: 'Sliema Seafront Hotel', stars: 4, price: 106, boards: ['BB', 'HB'], amenities: [...MORE, 'BEACH_ROCK'], airport: 'Malta' },
      { city: 'Buđiba', hotel: 'Bugibba Bay Hotel', stars: 3, price: 84, boards: ['BB', 'HB'], amenities: MORE, airport: 'Malta' },
    ],
  },
  {
    country: 'Portugal',
    supplier: 'Atlantico Viagens',
    destinacije: [
      { city: 'Lisabon', hotel: 'Lisboa Baixa Hotel', stars: 4, price: 118, boards: ['BB'], amenities: GRAD, airport: 'Lisabon' },
      { city: 'Porto', hotel: 'Porto Ribeira Hotel', stars: 4, price: 108, boards: ['BB'], amenities: GRAD, airport: 'Porto' },
      { city: 'Algarve', hotel: 'Algarve Ocean Resort', stars: 4, price: 126, boards: ['HB', 'AI'], amenities: MORE_PORODICNO, airport: 'Faro' },
    ],
  },
  {
    country: 'Severna Makedonija',
    supplier: 'Vardar Turs',
    destinacije: [
      { city: 'Ohrid', hotel: 'Ohrid Lake View Hotel', stars: 4, price: 62, boards: ['HB', 'BB'], amenities: [...MORE, 'POOL_OUTDOOR'], airport: 'Ohrid' },
      { city: 'Skoplje', hotel: 'Skopje City Hotel', stars: 4, price: 58, boards: ['BB'], amenities: GRAD, airport: 'Skoplje' },
    ],
  },
];

/** Polazišta za mock letove — sve iz Beograda, kako se i prodaje iz Srbije. */
const POLAZISTE = 'Beograd';

/** Cena leta u jednom smeru, po odredištu — gruba, ali ne slučajna (bliže = jeftinije). */
const CENA_LETA: Record<string, number> = {
  Solun: 96, Atina: 148, Krf: 132, Rodos: 176, Iraklion: 182, Zakintos: 158, Kavala: 104, Preveza: 138,
  Antalija: 168, Istanbul: 128, Bodrum: 186, Dalaman: 192, Gazipaša: 174,
  Tivat: 84, Podgorica: 78,
  Hurgada: 214, 'Šarm el Šeik': 228, 'Marsa Alam': 236, Kairo: 198,
  Barselona: 156, Madrid: 178, Malaga: 196, 'Palma de Majorka': 184, Tenerife: 268,
  Rim: 118, Milano: 126, Venecija: 112, Napulj: 138, Bolonja: 122, Firenca: 132,
  Dubrovnik: 96, Split: 92, Pula: 108, Zadar: 98,
  Burgas: 88, Varna: 92, Sofija: 74,
  Tirana: 86, Enfida: 188, Monastir: 184, 'Đerba': 206,
  Dubai: 298, 'Abu Dabi': 312,
  Larnaka: 168, Pafos: 182, Malta: 158,
  Lisabon: 208, Porto: 214, Faro: 222,
  Ohrid: 68, Skoplje: 62,
};

/** Tri perioda pokrivaju leto 2026, vansezonu i leto 2027 — svaki datum koji panel ponudi
 *  podrazumevano upada u jedan od njih, pa pretraga uvek ima šta da vrati. */
const PERIODI = [
  { stayFrom: '2026-04-01', stayTo: '2026-10-31', faktor: 1.0, kapacitet: 40, oznaka: 'leto 2026' },
  { stayFrom: '2026-11-01', stayTo: '2027-03-31', faktor: 0.68, kapacitet: 25, oznaka: 'vansezona' },
  { stayFrom: '2027-04-01', stayTo: '2027-10-31', faktor: 1.06, kapacitet: 40, oznaka: 'leto 2027' },
];

/** Nadoplata po tipu usluge u odnosu na osnovni noćni ceh dvokrevetne sobe. */
const DOPLATA_USLUGE: Record<Board, number> = { BB: 1.0, HB: 1.18, FB: 1.34, AI: 1.58 };

/** Standardni tipovi soba — isti oblik kao `mock-b2c.ts` (M2 §2.3a). */
const ROOM_TYPES = [
  { code: 'DBL', name: 'Dvokrevetna soba', maxAdults: 2, maxChildren: 1 },
  { code: 'TRPL', name: 'Trokrevetna soba', maxAdults: 3, maxChildren: 1 },
  { code: 'SGL', name: 'Jednokrevetna soba', maxAdults: 1, maxChildren: 0 },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function napraviUgovor(supplierId: string, broj: string, osnovnaCena: number, boards: Board[]) {
  const contract = await prisma.contract.create({
    data: {
      supplierId,
      contractNumber: broj,
      currency: 'EUR',
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2027-12-31'),
      cancellationTermsSummary: 'Bez naplate do 21 dan pre dolaska, potom 30% cene aranžmana.',
      documentUrl: `https://primer.rs/mock/${broj.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`,
      paymentTermsDays: 30,
      status: 'ACTIVE',
      defaultTipNastupanja: 'ORGANIZATOR',
    },
  });

  for (const p of PERIODI) {
    const period = await prisma.contractPeriod.create({
      data: {
        contractId: contract.id,
        stayFrom: new Date(p.stayFrom),
        stayTo: new Date(p.stayTo),
        roomType: 'DBL',
        allotmentMode: 'FIXED',
        totalCapacity: p.kapacitet,
        unitsSold: 0,
        releaseDaysBefore: 14,
      },
    });

    const linije: { contractPeriodId: string; boardType: Board; occupancy: string; priceBasis: 'PER_ROOM_PER_NIGHT'; price: number }[] = [];
    for (const board of boards) {
      const cena = osnovnaCena * p.faktor * DOPLATA_USLUGE[board];
      linije.push({ contractPeriodId: period.id, boardType: board, occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: eur(cena) });
      linije.push({ contractPeriodId: period.id, boardType: board, occupancy: '2+1', priceBasis: 'PER_ROOM_PER_NIGHT', price: eur(cena * 1.22) });
    }
    await prisma.rateLine.createMany({ data: linije });
    await prisma.cancellationRule.create({
      data: { contractPeriodId: period.id, daysBeforeStay: 21, refundPercentage: 70 },
    });
  }

  return contract;
}

async function main() {
  console.log('--- MOCK KATALOG DESTINACIJA ---\n');

  let brojUgovora = 0;
  let brojSmestaja = 0;
  const letovi = new Map<string, number>(); // aerodrom → cena, da se let ne pravi dvaput
  const transferi: { country: string; airport: string; city: string; supplierId: string }[] = [];

  for (const drzava of KATALOG) {
    const supplier = await prisma.supplier.create({
      data: {
        name: `${MOCK_MARKER} ${drzava.supplier}`,
        type: 'HOTEL',
        taxId: `${MOCK_MARKER}-${slugify(drzava.country)}`,
        registrationNumber: `${MOCK_MARKER}-${slugify(drzava.supplier)}`,
        country: drzava.country,
        contactName: 'Rezervacioni pult',
        contactEmail: `rezervacije@${slugify(drzava.supplier)}.example`,
        contactPhone: '+381 11 000 0000',
        status: 'ACTIVE',
      },
    });
    // M5 §2.1 — bez pravila marže u lancu pravljenje Ponude pada.
    await prisma.markupRule.create({
      data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 18, createdBy: null },
    });

    for (const d of drzava.destinacije) {
      brojUgovora++;
      const contract = await napraviUgovor(
        supplier.id,
        `${MOCK_MARKER}/${slugify(drzava.country)}-${String(brojUgovora).padStart(3, '0')}`,
        d.price,
        d.boards,
      );

      const slug = `${slugify(d.hotel)}-${MOCK_SLUG}`;
      await prisma.product.create({
        data: {
          type: 'ACCOMMODATION',
          sourceType: 'CONTRACTED',
          sourceContractId: contract.id,
          destinationCountry: drzava.country,
          destinationCity: d.city,
          media: [],
          attributes: {
            category: d.stars,
            roomTypes: ROOM_TYPES,
            amenities: d.amenities,
            board_types: d.boards,
          },
          status: 'ACTIVE',
          visibleChannels: ['B2C_SITE', 'B2B_PORTAL'],
          createdBy: null,
          translations: {
            create: [
              {
                languageCode: LanguageCode.sr,
                name: `${d.hotel} ${d.stars}*`,
                description: `${d.hotel} se nalazi u mestu ${d.city} (${drzava.country}). Kategorija ${d.stars} zvezdice, usluga: ${d.boards.join(', ')}.\n\nMOCK zapis za lokalni razvoj — opis nije stvaran sadržaj hotela.`,
                slug,
                translationSource: 'MANUAL',
                isReviewed: true,
              },
              {
                languageCode: LanguageCode.en,
                name: `${d.hotel} ${d.stars}*`,
                description: `${d.hotel} is located in ${d.city}, ${drzava.country}. Category ${d.stars} stars.\n\nMOCK record for local development.`,
                slug: `${slug}-en`,
                translationSource: 'MANUAL',
                isReviewed: true,
              },
            ],
          },
        },
      });
      brojSmestaja++;

      if (d.airport) {
        if (CENA_LETA[d.airport] !== undefined) letovi.set(d.airport, CENA_LETA[d.airport]);
        // Transfer se pravi samo kad aerodrom NIJE isto mesto gde je hotel (npr. Solun→Sitonija);
        // „transfer Beograd–Beograd" ne postoji kao proizvod.
        if (d.airport !== d.city) {
          transferi.push({ country: drzava.country, airport: d.airport, city: d.city, supplierId: supplier.id });
        }
      }
    }
    console.log(`  ${drzava.country.padEnd(28)} ${drzava.destinacije.length} destinacija`);
  }

  // ==========================================================================
  // Letovi (M2 §2.3 — jedan Product = jedna noga leta) i transferi (aerodrom → mesto).
  // Oba nose `attributes.route.origin_city`/`destination_city`, što `GET /search?originCity=`
  // stvarno filtrira (M5 §3.0d.1).
  // ==========================================================================
  const avioSupplier = await prisma.supplier.create({
    data: {
      name: `${MOCK_MARKER} Air Consolidator`,
      type: 'PREVOZNIK',
      taxId: `${MOCK_MARKER}-avio`,
      registrationNumber: `${MOCK_MARKER}-avio`,
      country: 'Srbija',
      contactName: 'Avio pult',
      contactEmail: 'avio@konsolidator.example',
      contactPhone: '+381 11 000 0001',
      status: 'ACTIVE',
    },
  });
  await prisma.markupRule.create({
    data: { scopeType: 'M3_SUPPLIER', scopeId: avioSupplier.id, percentage: 8, createdBy: null },
  });

  let brojLetova = 0;
  for (const [aerodrom, cena] of [...letovi.entries()].sort()) {
    if (aerodrom === POLAZISTE) continue;
    for (const cabin of ['ECONOMY', 'BUSINESS'] as const) {
      brojUgovora++;
      const contract = await napraviUgovor(
        avioSupplier.id,
        `${MOCK_MARKER}/avio-${slugify(aerodrom)}-${cabin === 'ECONOMY' ? 'y' : 'c'}`,
        cabin === 'ECONOMY' ? cena : Math.round(cena * 2.4),
        ['BB'],
      );
      const slug = `let-${slugify(POLAZISTE)}-${slugify(aerodrom)}-${cabin.toLowerCase()}-${MOCK_SLUG}`;
      await prisma.product.create({
        data: {
          type: 'FLIGHT',
          sourceType: 'CONTRACTED',
          sourceContractId: contract.id,
          destinationCountry: KATALOG.find((k) => k.destinacije.some((d) => d.airport === aerodrom))?.country ?? 'Srbija',
          destinationCity: aerodrom,
          media: [],
          attributes: {
            airline: 'Mock Airways',
            cabin_class: cabin,
            route: { origin_city: POLAZISTE, destination_city: aerodrom },
          },
          status: 'ACTIVE',
          visibleChannels: ['B2C_SITE', 'B2B_PORTAL'],
          createdBy: null,
          translations: {
            create: [
              {
                languageCode: LanguageCode.sr,
                name: `${POLAZISTE} → ${aerodrom} (${cabin === 'ECONOMY' ? 'ekonomska' : 'biznis'} klasa)`,
                description: `Let u jednom smeru, ${POLAZISTE} — ${aerodrom}.\n\nMOCK zapis za lokalni razvoj.`,
                slug,
                translationSource: 'MANUAL',
                isReviewed: true,
              },
              {
                languageCode: LanguageCode.en,
                name: `${POLAZISTE} → ${aerodrom} (${cabin.toLowerCase()})`,
                description: `One-way flight, ${POLAZISTE} — ${aerodrom}.\n\nMOCK record for local development.`,
                slug: `${slug}-en`,
                translationSource: 'MANUAL',
                isReviewed: true,
              },
            ],
          },
        },
      });
      brojLetova++;
    }
  }
  console.log(`\n  ${brojLetova} letova iz ${POLAZISTE}a (ekonomska + biznis klasa po odredištu)`);

  let brojTransfera = 0;
  for (const t of transferi) {
    brojUgovora++;
    const contract = await napraviUgovor(
      t.supplierId,
      `${MOCK_MARKER}/transfer-${slugify(t.airport)}-${slugify(t.city)}`,
      38,
      ['BB'],
    );
    const slug = `transfer-${slugify(t.airport)}-${slugify(t.city)}-${MOCK_SLUG}`;
    await prisma.product.create({
      data: {
        type: 'TRANSFER',
        sourceType: 'CONTRACTED',
        sourceContractId: contract.id,
        destinationCountry: t.country,
        destinationCity: t.city,
        media: [],
        attributes: {
          vehicle_type: 'MINIVAN',
          max_passengers: 7,
          route: { origin_city: t.airport, destination_city: t.city },
        },
        status: 'ACTIVE',
        visibleChannels: ['B2C_SITE', 'B2B_PORTAL'],
        createdBy: null,
        translations: {
          create: [
            {
              languageCode: LanguageCode.sr,
              name: `Transfer aerodrom ${t.airport} — ${t.city}`,
              description: `Privatni transfer klimatizovanim kombijem, do 7 putnika.\n\nMOCK zapis za lokalni razvoj.`,
              slug,
              translationSource: 'MANUAL',
              isReviewed: true,
            },
            {
              languageCode: LanguageCode.en,
              name: `${t.airport} airport transfer — ${t.city}`,
              description: `Private air-conditioned van transfer, up to 7 passengers.\n\nMOCK record for local development.`,
              slug: `${slug}-en`,
              translationSource: 'MANUAL',
              isReviewed: true,
            },
          ],
        },
      },
    });
    brojTransfera++;
  }
  console.log(`  ${brojTransfera} transfera (aerodrom → mesto)`);

  console.log(`\nUkupno: ${brojSmestaja} smeštaja, ${brojLetova} letova, ${brojTransfera} transfera, ${brojUgovora} ugovora.`);
  console.log(`Države u predlozima: ${KATALOG.length}.`);
  console.log('\nSLEDEĆI KORAK — koordinate se NE upisuju ovde (M5 §3.0h.1, vlasnikova odluka):');
  console.log('  npm run geocode:products --workspace=apps/api');
  console.log('Bez toga mapa u pretrazi nema šta da prikaže za ove proizvode.');
}

// Trap 5.2 — skripta za brisanje uvozi konstante odavde; bez ove ograde bi ih ponovo ubacila.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
