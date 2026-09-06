import RegisterTab from '@/components/RegisterTab';
import { apiFetch } from '@/lib/api-client';
import BookingsListClient from './BookingsListClient';
import type { RealBooking } from './RealBookingsTable';
import RealFilterBar, { type BookingFilters } from './RealFilterBar';
import type { FilterOption } from './RealFilterFields';
import { FilterModeProvider } from './FilterModeContext';
import FilterModeToggle from './FilterModeToggle';
import Pagination from '@/components/Pagination';

// Liste za "dodatni filteri" (6.9.2026 dopuna) — svaka se učitava nezavisno i tiho pada nazad na
// praznu listu (a ne ruši celu stranicu) ako pozivalac nema dozvolu za taj konkretan resurs
// (npr. dobavljači su M3 domen, ne M5) — filter tad samo ostaje bez opcija, isto ponašanje kao
// ostatak ekrana kad neki opcioni podatak nedostaje.
async function safeList<T>(path: string): Promise<T[]> {
  try {
    return await apiFetch<T[]>(path);
  } catch {
    return [];
  }
}


// M5 spec v1.54 (24.8.2026, na zahtev vlasnika: "krenite" posle potvrđenog v1 skupa filtera) —
// STVARNA lista, prelazi sa MOCK-a (v1.42-v1.53). `GET /sales/bookings` sad prima pun v1 skup
// pravih filtera (vidi tabelu u spec-u); server komponenta samo prosleđuje `searchParams` kao
// query string, isti obrazac kao postojeći `/marketing`/`/podrska`/`/b2b/rabati`.
export default async function BookingListPage(props: { searchParams: Promise<BookingFilters> }) {
  const searchParams = await props.searchParams;
  let bookings: RealBooking[] = [];
  // Straničenje (5.9.2026, dok. 39 nalaz 2.2) — do danas je lista tiho odsecala na 200 redova
  // i ništa na ekranu nije reklo da nešto nedostaje.
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let limit = 50;
  let error: string | null = null;
  try {
    // Multiselect (24.8.2026, na zahtev vlasnika) — `value` može biti `string[]` za polja sa
    // više izabranih opcija (status/uplata/tip nastupanja/tip proizvoda); svaka vrednost niza
    // se dodaje kao poseban `key=vrednost` par (`append`, ne `set`) da `GET /sales/bookings`
    // (poglavlje 11) dobije isti oblik ponovljenog parametra koji NestJS `@Query` prirodno
    // parsira nazad u niz.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      // `periodView`/`periodAnchor` (dopuna 27.8.2026, PeriodQuickFilter.tsx) su ISKLJUČIVO
      // UI stanje prekidača Dan/Nedelja/Mesec — ne stvarni `GET /sales/bookings` parametri
      // (stvaran filter i dalje ide preko `stayFrom`/`stayTo`, koje prekidač samo postavlja).
      if (key === 'periodView' || key === 'periodAnchor') continue;
      if (Array.isArray(value)) {
        for (const v of value) if (v) params.append(key, v);
      } else if (value) {
        params.set(key, value);
      }
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await apiFetch<{ data: RealBooking[]; total: number; page: number; pageCount: number; limit: number }>(`/sales/bookings${qs}`);
    bookings = result.data;
    total = result.total;
    page = result.page;
    pageCount = result.pageCount;
    limit = result.limit;
  } catch {
    error = 'Nemate dozvolu za uvid u rezervacije (M5/booking/VIEW).';
  }

  const [branchRows, employeeRows, supplierRows] = await Promise.all([
    safeList<{ id: string; name: string }>('/iam/branches'),
    safeList<{ id: string; fullName: string }>('/iam/users/directory'),
    safeList<{ id: string; name: string }>('/contracting/suppliers'),
  ]);
  const branches: FilterOption[] = branchRows.map((b) => ({ id: b.id, name: b.name }));
  const employees: FilterOption[] = employeeRows.map((u) => ({ id: u.id, name: u.fullName }));
  const suppliers: FilterOption[] = supplierRows.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="p-6">
      <RegisterTab label="Lista rezervacija" />
      <FilterModeProvider>
        {/* Prekidač traka/prozor/levi panel u liniji sa naslovom, iznad trake ikonica (6.9.2026,
            vlasnikov zahtev: "traka prozor levi panel staviti u liniji sa naslovom taba iznad
            brzih [ikonica] u desnom kraju") — stanje živi u `FilterModeContext.tsx` jer ga i
            ovaj red i `RealFilterBar.tsx` (unutar `BookingsListClient`, ispod trake ikonica)
            moraju deliti. */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">Lista rezervacija</h1>
          <FilterModeToggle />
        </div>

        {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
        {!error && (
          <>
            <BookingsListClient
              bookings={bookings}
              filterBar={<RealFilterBar filters={searchParams ?? {}} branches={branches} employees={employees} suppliers={suppliers} />}
            />
            {/* Straničenje (5.9.2026, dok. 39 nalaz 2.2) — traka uvek kaže i UKUPAN broj, ne samo
                koja je strana: nemogućnost da se sazna koliko rezervacija zapravo ima bila je
                jezgro nalaza. */}
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              shown={bookings.length}
              limit={limit}
              basePath="/rezervacije/lista"
              searchParams={(searchParams ?? {}) as Record<string, string | string[] | undefined>}
              itemLabel="rezervacija"
            />
          </>
        )}
      </FilterModeProvider>
    </div>
  );
}
