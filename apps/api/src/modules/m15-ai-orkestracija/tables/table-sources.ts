// M15 spec §6.5.4.10 / M17 §6e (19.9.2026) — zatvoren registar izvora za „Terminal tabelu".
//
// Isti princip kao `filterable-views.ts` (§6.5.4.2) i `report-views.ts` (§6.9.6): model (ili
// čovek kroz ekran „Nova tabela") bira ISKLJUČIVO ime izvora i polja iz ove liste — nikad
// sopstveni upit, nikad naziv kolone van registra. Podatke daje postojeći servis modula, iza
// ISTE dozvole koju taj podatak već nosi na svom ekranu.
//
// Svaki izvor opisuje kolone (tip, da li je izvedena — za scenario, M17 §6e.4), ključ reda
// (`_key`, za spajanje dva perioda) i link reda (`_href`, klik otvara zapis). Dodavanje izvora
// = jedan unos ovde + red u tabeli §6.5.4.10, bez novog ekrana.

export type TableColumnType = 'text' | 'number' | 'money' | 'date' | 'percent';

/**
 * Izvedena kolona za scenario (M17 §6e.4): `formula` je IME formule koju kod u pregledaču zna
 * (`scenario.ts`), ne izraz. Registar time kaže „ovo se sme preračunati", a ne „kako".
 */
export type ScenarioFormula = 'nabavna' | 'prodajna' | 'marza' | 'marza_pct' | 'provizija' | 'neto';

export interface TableColumn {
  key: string;
  label: string;
  type: TableColumnType;
  /** Nabavna/marža/neto — samo INTERNAL_PANEL (M5 §6.2); registar to označi, servis sprovede. */
  internalOnly?: boolean;
  derived?: ScenarioFormula;
}

export interface TableFilterDef {
  description: string;
  enumValues?: readonly string[];
  multi?: boolean;
  required?: boolean;
}

export interface TableSourceDef {
  id: TableSourceId;
  label: string;
  permission: { module: string; resource: string; action: string };
  filters: Record<string, TableFilterDef>;
  columns: TableColumn[];
  /** Kolona sa datumom po kojoj `compare` (drugi period) pomera filtere; `null` = bez poređenja. */
  periodFilter: { from: string; to: string } | null;
}

export const TABLE_SOURCE_IDS = ['bookings', 'catalog', 'funnel', 'work_queue'] as const;
export type TableSourceId = (typeof TABLE_SOURCE_IDS)[number];

/** §6.5.4.10 — granica po upitu; preko toga `truncated: true`. */
export const MAX_TABLE_ROWS = 2000;

const BOOKING_STATUSES = [
  'PENDING_SUPPLIER_CONFIRMATION',
  'CONFIRMED',
  'MODIFIED',
  'CANCELLED',
  'COMPLETED',
] as const;
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING'] as const;
const PRODUCT_TYPES = [
  'ACCOMMODATION',
  'PACKAGE',
  'TRANSFER',
  'EXCURSION',
  'FLIGHT',
  'INSURANCE',
  'TRANSPORT',
  'TICKET',
  'EVENT',
  'CRUISE',
] as const;
const CHANNELS = [
  'B2C_SITE',
  'B2B_PORTAL',
  'MOBILE',
  'INTERNAL_PANEL',
  'PHONE',
  'MCP_AGENT',
] as const;
const FUNNEL_DIMENSIONS = [
  'by_destination',
  'by_channel',
  'by_lead_time',
  'shown_not_chosen',
  'by_markup_rule',
] as const;

export const TABLE_SOURCES: Record<TableSourceId, TableSourceDef> = {
  bookings: {
    id: 'bookings',
    label: 'Rezervacije',
    permission: { module: 'M5', resource: 'booking', action: 'VIEW' },
    // Isti skup kao `/rezervacije/lista` filter traka (filterable-views `bookings`).
    filters: {
      status: { description: 'Status rezervacije', enumValues: BOOKING_STATUSES, multi: true },
      paymentStatus: { description: 'Status uplate', enumValues: PAYMENT_STATUSES, multi: true },
      productType: { description: 'Tip proizvoda', enumValues: PRODUCT_TYPES, multi: true },
      channel: { description: 'Kanal', enumValues: CHANNELS },
      buyerName: { description: 'Nosilac rezervacije (deo teksta)' },
      bookingNumber: { description: 'Broj rezervacije (deo teksta)' },
      currency: { description: 'Valuta, npr. EUR' },
      destinationCity: { description: 'Grad destinacije' },
      destinationCountry: { description: 'Država destinacije' },
      productName: { description: 'Naziv hotela/proizvoda (deo teksta)' },
      createdFrom: { description: 'Kreirano OD, YYYY-MM-DD' },
      createdTo: { description: 'Kreirano DO, YYYY-MM-DD' },
      stayFrom: { description: 'Dolazak OD, YYYY-MM-DD' },
      stayTo: { description: 'Dolazak DO, YYYY-MM-DD' },
    },
    columns: [
      { key: 'broj', label: 'Broj', type: 'text' },
      { key: 'kupac', label: 'Kupac', type: 'text' },
      { key: 'kanal', label: 'Kanal', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'uplata', label: 'Uplata', type: 'text' },
      { key: 'drzava', label: 'Država', type: 'text' },
      { key: 'mesto', label: 'Mesto', type: 'text' },
      { key: 'proizvod', label: 'Vrsta', type: 'text' },
      { key: 'kreirano', label: 'Kreirano', type: 'date' },
      { key: 'dolazak', label: 'Dolazak', type: 'date' },
      { key: 'odlazak', label: 'Odlazak', type: 'date' },
      { key: 'noci', label: 'Noći', type: 'number' },
      { key: 'valuta', label: 'Valuta', type: 'text' },
      { key: 'prodajna', label: 'Prodajna', type: 'money', derived: 'prodajna' },
      { key: 'nabavna', label: 'Nabavna', type: 'money', internalOnly: true, derived: 'nabavna' },
      { key: 'marza', label: 'Marža', type: 'money', internalOnly: true, derived: 'marza' },
      {
        key: 'marza_pct',
        label: 'Marža %',
        type: 'percent',
        internalOnly: true,
        derived: 'marza_pct',
      },
      // M7 provizija subagenta nije snimljena na rezervaciji (računa se na ponudi, M7 §5) —
      // kolona postoji radi scenarija (§6e.4), vrednost iz podatka je 0 dok M7 ne upiše.
      {
        key: 'provizija',
        label: 'Provizija',
        type: 'money',
        internalOnly: true,
        derived: 'provizija',
      },
      { key: 'neto', label: 'Neto', type: 'money', internalOnly: true, derived: 'neto' },
    ],
    periodFilter: { from: 'createdFrom', to: 'createdTo' },
  },
  catalog: {
    id: 'catalog',
    label: 'Katalog',
    permission: { module: 'M2', resource: 'product', action: 'VIEW' },
    filters: {
      type: { description: 'Vrsta proizvoda', enumValues: PRODUCT_TYPES },
      destinationCountry: { description: 'Država' },
      status: { description: 'Status', enumValues: ['DRAFT', 'ACTIVE', 'ARCHIVED'] },
    },
    columns: [
      { key: 'naziv', label: 'Naziv', type: 'text' },
      { key: 'vrsta', label: 'Vrsta', type: 'text' },
      { key: 'drzava', label: 'Država', type: 'text' },
      { key: 'mesto', label: 'Mesto', type: 'text' },
      { key: 'zvezdice', label: 'Zvezdice', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'izvor', label: 'Izvor', type: 'text' },
      { key: 'dobavljac', label: 'Dobavljač', type: 'text', internalOnly: true },
    ],
    periodFilter: null,
  },
  funnel: {
    id: 'funnel',
    label: 'Lijevak (upit → rezervacija)',
    // `by_markup_rule` traži `report:profitability` — servis to proverava posebno.
    permission: { module: 'M13', resource: 'report:temporal', action: 'VIEW' },
    filters: {
      dimension: {
        description: 'Dimenzija lijevka',
        enumValues: FUNNEL_DIMENSIONS,
        required: true,
      },
      from: { description: 'Upiti OD, YYYY-MM-DD' },
      to: { description: 'Upiti DO, YYYY-MM-DD' },
    },
    // Kolone zavise od dimenzije — servis ih izvodi iz odgovora (§4.4a oblici su fiksni).
    columns: [],
    periodFilter: { from: 'from', to: 'to' },
  },
  work_queue: {
    id: 'work_queue',
    label: 'Radni spisak kapaciteta',
    permission: { module: 'M3', resource: 'capacity', action: 'VIEW' },
    filters: {
      kind: {
        description: 'Vrsta reda',
        enumValues: [
          'OVERBOOKED',
          'LOW_UNITS',
          'BLOCK_EXPIRING',
          'STOP_SALE_ENDING',
          'RELEASE_DUE',
          'OFFER_EXPIRING',
        ],
        multi: true,
      },
    },
    columns: [
      { key: 'vrsta', label: 'Vrsta', type: 'text' },
      { key: 'datum', label: 'Datum', type: 'date' },
      { key: 'objekat', label: 'Objekat', type: 'text' },
      { key: 'dobavljac', label: 'Dobavljač', type: 'text', internalOnly: true },
      { key: 'drzava', label: 'Država', type: 'text' },
      { key: 'mesto', label: 'Mesto', type: 'text' },
      { key: 'tip_sobe', label: 'Tip sobe', type: 'text' },
      { key: 'detalj', label: 'Detalj', type: 'text' },
      { key: 'vrednost', label: 'Vrednost', type: 'number' },
    ],
    periodFilter: null,
  },
};

export interface TableSpec {
  source: TableSourceId;
  filters?: Record<string, string | string[]>;
  title?: string;
  /** Podskup kolona (ključevi iz registra); prazno = sve. */
  columns?: string[];
  /** M17 §6e.3f — drugi period za poređenje (isti upit, drugi opseg). */
  compare?: { from: string; to: string };
}

/**
 * Validacija filtera protiv registra — nepoznato polje, nedozvoljena vrednost ili nedostajuće
 * obavezno polje vraćaju čitljivu grešku (modelu kao tool_result, čoveku kao 400).
 */
export function validateTableSpec(spec: TableSpec): { error: string } | { ok: true } {
  const def = TABLE_SOURCES[spec.source];
  if (!def) {
    return {
      error: `Nepoznat izvor "${spec.source}". Dozvoljeni: ${TABLE_SOURCE_IDS.join(', ')}.`,
    };
  }
  const filters = spec.filters ?? {};
  for (const key of Object.keys(filters)) {
    const f = def.filters[key];
    if (!f) {
      return {
        error: `Nepoznat filter "${key}" za izvor "${spec.source}". Dozvoljeni: ${Object.keys(def.filters).join(', ')}.`,
      };
    }
    const raw = filters[key];
    const values = Array.isArray(raw) ? raw : [raw];
    if (!f.multi && values.length > 1) return { error: `Filter "${key}" prima jednu vrednost.` };
    if (f.enumValues) {
      const bad = values.find((v) => !f.enumValues!.includes(v));
      if (bad) {
        return {
          error: `Vrednost "${bad}" nije dozvoljena za "${key}". Dozvoljene: ${f.enumValues.join(', ')}.`,
        };
      }
    }
  }
  for (const [key, f] of Object.entries(def.filters)) {
    if (f.required && !(key in filters))
      return { error: `Filter "${key}" je obavezan za izvor "${spec.source}".` };
  }
  if (spec.columns?.length && def.columns.length) {
    const bad = spec.columns.find((c) => !def.columns.some((x) => x.key === c));
    if (bad) {
      return {
        error: `Nepoznata kolona "${bad}". Dozvoljene: ${def.columns.map((c) => c.key).join(', ')}.`,
      };
    }
  }
  if (spec.compare && !def.periodFilter) {
    return { error: `Izvor "${spec.source}" nema period, pa poređenje dva perioda nije moguće.` };
  }
  return { ok: true };
}
