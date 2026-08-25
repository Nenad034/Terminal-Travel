// M15 spec §6.5.4.2 dopuna (25.8.2026, na zahtev vlasnika: "da li sada korisnik može kroz AI
// agenta da zatraži pretragu po nekom filteru ili više njih... želim to za svaki modul") —
// zatvoren, ručno pregledan registar "pogleda" koje `filter_list` alat (omnisearch.service.ts)
// sme da filtrira, isti "defense in depth" princip kao BiTerminalAgent `report-views.ts`
// (§6.9.6) — model bira SAMO imena iz ove liste, nikad sopstveni upit/URL. Svaki pogled
// odgovara TAČNO postojećoj, već izgrađenoj i uživo proverenoj filter traci u panelu (§11
// napomena — modul mora imati STVARNU, backend-verifikovanu filter traku da bi ušao ovde;
// forme koje samo filtriraju već preuzetu listu na klijentu NISU uključene, jer bi link sa
// query parametrima tiho ne radio ništa na serverskoj strani).
export interface FilterFieldDef {
  description: string;
  /** Kad je postavljeno, vrednost (ili SVAKA vrednost ako je niz) mora tačno poklopiti jednu od ovih. */
  enumValues?: readonly string[];
  /** Polje prihvata više vrednosti odjednom (ponovljen query parametar, isti obrazac kao M5 MultiSelectDropdown). */
  multi?: boolean;
  required?: boolean;
}

export interface FilterableView {
  id: string;
  label: string;
  listPath: string;
  fields: Record<string, FilterFieldDef>;
  permission: { module: string; resource: string; action: string } | ((values: Record<string, string[]>) => { module: string; resource: string; action: string });
}

const BOOKING_STATUSES = ['PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'COMPLETED'] as const;
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING'] as const;
const TIP_NASTUPANJA = ['ORGANIZATOR', 'POSREDNIK'] as const;
const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT', 'CRUISE'] as const;
const CONTENT_TYPES = ['BLOG_POST', 'SOCIAL_POST', 'EMAIL_NEWSLETTER', 'BANNER', 'STATIC_PAGE'] as const;
const CONTENT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED'] as const;
const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;
const SIGNAL_TYPES = [
  'PROVIDER_ERROR_SPIKE', 'PAYMENT_FAILURE_SPIKE', 'GUEST_REGISTRATION_FAILED', 'FIELD_INCIDENT_URGENT',
  'AUTH_ANOMALY', 'TOKEN_USAGE_ANOMALY', 'RECONCILIATION_MISMATCH', 'PROVIDER_DEGRADED',
  'LOW_CAPACITY_CRITICAL', 'HELP_AGENT_ABUSE_PATTERN', 'PAYMENT_DEADLINE_MISSED',
] as const;
const AUDIENCES = ['STAFF', 'SUBAGENT', 'BUSINESS_CLIENT', 'PUBLIC_GUEST'] as const;
const CONFIDENCES = ['HIGH', 'LOW', 'NONE'] as const;
const REPORT_TABS = ['profitabilnost', 'prodaja', 'smestaj', 'dinamicki', 'marketing'] as const;
const REPORT_RESOURCE_BY_TAB: Record<string, string> = {
  profitabilnost: 'report:profitability',
  prodaja: 'report:sales',
  smestaj: 'report:occupancy',
  dinamicki: 'report:dynamic',
  marketing: 'report:marketing',
};

export const FILTERABLE_VIEWS: Record<string, FilterableView> = {
  bookings: {
    id: 'bookings',
    label: 'Lista rezervacija',
    listPath: '/rezervacije/lista',
    permission: { module: 'M5', resource: 'booking', action: 'VIEW' },
    fields: {
      status: { description: 'Status rezervacije', enumValues: BOOKING_STATUSES, multi: true },
      paymentStatus: { description: 'Status uplate', enumValues: PAYMENT_STATUSES, multi: true },
      tipNastupanja: { description: 'Tip nastupanja agencije', enumValues: TIP_NASTUPANJA, multi: true },
      productType: { description: 'Tip proizvoda', enumValues: PRODUCT_TYPES, multi: true },
      buyerName: { description: 'Ime/naziv nosioca rezervacije (deo teksta)' },
      bookingNumber: { description: 'Broj rezervacije (deo teksta), npr. TT-2027-...' },
      currency: { description: 'Valuta, npr. EUR' },
      destinationCity: { description: 'Grad destinacije' },
      destinationCountry: { description: 'Država destinacije' },
      hasTravelGuarantee: { description: 'Da li postoji garancija putovanja', enumValues: ['true', 'false'] },
      createdFrom: { description: 'Datum kreiranja OD, YYYY-MM-DD' },
      createdTo: { description: 'Datum kreiranja DO, YYYY-MM-DD' },
      stayFrom: { description: 'Datum dolaska OD, YYYY-MM-DD' },
      stayTo: { description: 'Datum dolaska DO, YYYY-MM-DD' },
      returnFrom: { description: 'Datum odlaska OD, YYYY-MM-DD' },
      returnTo: { description: 'Datum odlaska DO, YYYY-MM-DD' },
    },
  },
  crm: {
    id: 'crm',
    label: 'Gosti i nalogodavci (CRM)',
    listPath: '/crm',
    permission: { module: 'M6', resource: 'client-account', action: 'VIEW' },
    fields: {
      email: { description: 'Email nalogodavca (deo teksta)' },
      taxId: { description: 'PIB (za pravna lica)' },
    },
  },
  marketing: {
    id: 'marketing',
    label: 'Marketing sadržaj',
    listPath: '/marketing',
    permission: { module: 'M12', resource: 'content', action: 'VIEW' },
    fields: {
      type: { description: 'Tip sadržaja', enumValues: CONTENT_TYPES },
      status: { description: 'Status sadržaja', enumValues: CONTENT_STATUSES },
    },
  },
  health_signals: {
    id: 'health_signals',
    label: 'Operativni nadzor',
    listPath: '/nadzor',
    permission: { module: 'M18', resource: 'health-signal', action: 'VIEW' },
    fields: {
      module: { description: 'Kôd modula izvora signala, npr. M5' },
      type: { description: 'Tip signala', enumValues: SIGNAL_TYPES },
      severity: { description: 'Ozbiljnost', enumValues: SEVERITIES },
    },
  },
  help_questions: {
    id: 'help_questions',
    label: 'Pitanja — Centar za pomoć',
    listPath: '/pomoc/pitanja',
    permission: { module: 'M21', resource: 'question-log', action: 'VIEW' },
    fields: {
      audienceContext: { description: 'Ko je pitao', enumValues: AUDIENCES },
      confidence: { description: 'Pouzdanost odgovora', enumValues: CONFIDENCES },
    },
  },
  reports: {
    id: 'reports',
    label: 'Izveštaji',
    listPath: '/izvestaji',
    permission: (values) => ({ module: 'M13', resource: REPORT_RESOURCE_BY_TAB[values.tab?.[0] ?? ''] ?? 'report:sales', action: 'VIEW' }),
    fields: {
      tab: { description: 'Koji izveštaj', enumValues: REPORT_TABS, required: true },
      from: { description: 'Datum OD, YYYY-MM-DD' },
      to: { description: 'Datum DO, YYYY-MM-DD' },
      destinationCountry: { description: 'Država destinacije (profitabilnost/smeštaj)' },
      destinationCity: { description: 'Grad destinacije (profitabilnost/smeštaj)' },
      supplierId: { description: 'ID dobavljača (profitabilnost/smeštaj)' },
      providerCode: { description: 'Kôd M4 provajdera (profitabilnost)' },
      channel: { description: 'Prodajni kanal (profitabilnost/prodaja)' },
      productType: { description: 'Tip proizvoda (prodaja)', enumValues: PRODUCT_TYPES },
      groupBy: { description: 'Razvrstavanje (smeštaj: jedna vrednost iz room_type/board_type/stars/accommodation_type; dinamički: dimenzije odvojene zarezom)' },
    },
  },
};

export const FILTERABLE_VIEW_IDS = Object.keys(FILTERABLE_VIEWS);

function toArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [String(value)];
}

/**
 * Validira `filters` protiv `view.fields` (nepoznat ključ, nedostajuće obavezno polje,
 * nedozvoljena enum vrednost → čitljiva greška vraćena MODELU, ne tiha ignoracija) i vraća
 * gotov query string + normalizovane vrednosti (potrebne za permission() kod `reports`).
 */
export function buildFilterQuery(view: FilterableView, filters: Record<string, unknown>): { qs: string; values: Record<string, string[]> } | { error: string } {
  const unknownKeys = Object.keys(filters).filter((k) => !(k in view.fields));
  if (unknownKeys.length > 0) {
    return { error: `Nepoznato polje "${unknownKeys[0]}" za pogled "${view.id}". Dozvoljena polja: ${Object.keys(view.fields).join(', ')}.` };
  }

  const values: Record<string, string[]> = {};
  const params = new URLSearchParams();

  for (const [key, def] of Object.entries(view.fields)) {
    const raw = toArray(filters[key]);
    if (raw.length === 0) {
      if (def.required) return { error: `Polje "${key}" je obavezno za pogled "${view.id}".` };
      continue;
    }
    if (!def.multi && raw.length > 1) {
      return { error: `Polje "${key}" ne prihvata više vrednosti odjednom.` };
    }
    if (def.enumValues) {
      const invalid = raw.find((v) => !def.enumValues!.includes(v));
      if (invalid) {
        return { error: `Nedozvoljena vrednost "${invalid}" za polje "${key}". Dozvoljeno: ${def.enumValues.join(', ')}.` };
      }
    }
    values[key] = raw;
    for (const v of raw) params.append(key, v);
  }

  return { qs: params.toString(), values };
}
