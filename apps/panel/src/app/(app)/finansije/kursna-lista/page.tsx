import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Pagination from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import ExchangeRateForm from './ExchangeRateForm';

interface ExchangeRate {
  id: string;
  currency: string;
  rateDate: string;
  /** Prisma `Decimal` stiže kao STRING kroz JSON (zamka 10.1) — nikad `number`. */
  nbsMiddleRate: string;
  source: 'NBS_API' | 'MANUAL';
  createdAt: string;
}

interface StranicenOdgovor {
  data: ExchangeRate[];
  total: number;
  page: number;
  pageCount: number;
  limit: number;
}

/**
 * Kursna lista (M10 spec §3.1/§3.1a, M17 spec §4 — Faza 2 „Finansije").
 *
 * ZAŠTO OVAJ EKRAN POSTOJI (6.9.2026, na zahtev vlasnika): kurs se povlači automatski svako
 * jutro, a od 6.9.2026. sistem sam popunjava i propuštene dane unazad. Do danas je, međutim,
 * `GET`/`POST /finance/exchange-rates` postojao BEZ ijednog ekrana — kurs se nije mogao ni
 * videti ni ručno uneti kroz interfejs. Taj nedostatak se ne primećuje dok automatika radi, a
 * primeti se tačno onda kad zakaže (izvor je javna stranica čiji format nije ugovoren), što je
 * i jedini trenutak kad ručni unos treba.
 *
 * Ekran zato radi dve stvari i ništa više: pokazuje ŠTA je u listi (uključujući odakle je došlo
 * — NBS ili ruka) i omogućava upis kad automatika zakaže.
 */
export default async function KursnaListaPage(props: {
  searchParams: Promise<{ currency?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canEdit = hasPermission(me, 'M10', 'exchange-rate', 'EDIT');

  let rates: ExchangeRate[] = [];
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let limit = 50;
  let error: string | null = null;

  try {
    const qs = new URLSearchParams();
    if (searchParams?.currency) qs.set('currency', searchParams.currency);
    if (searchParams?.page) qs.set('page', searchParams.page);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const result = await apiFetch<StranicenOdgovor>(`/finance/exchange-rates${suffix}`);
    rates = result.data;
    total = result.total;
    page = result.page;
    pageCount = result.pageCount;
    limit = result.limit;
  } catch {
    error = 'Nemate dozvolu za uvid u kursnu listu (M10/exchange-rate/VIEW).';
  }

  const najnoviji = rates[0];
  const danasnji = najnoviji ? danaOd(najnoviji.rateDate) : null;

  return (
    <div className="p-6">
      <RegisterTab label="Kursna lista" />
      <h1 className="mb-1 text-lg font-semibold text-ink">Kursna lista</h1>
      <p className="mb-4 text-xs text-ink-faint">
        Srednji kurs Narodne banke Srbije. Sistem ga povlači sam svakog jutra i sam popunjava
        propuštene dane iz poslednjih mesec dana. Ručni unos ispod postoji za slučaj da taj
        automatski uvoz zakaže.
      </p>

      {/* Upozorenje kad je poslednji kurs zastareo. Namerno se računa od NAJNOVIJEG zapisa, ne
          od „danas": vikendom i praznikom kurs se ne objavljuje, pa bi provera „ima li kurs za
          danas" dizala lažnu uzbunu svake subote. Tri dana pokriva vikend + praznik. */}
      {danasnji !== null && danasnji > 3 && (
        <p className="mb-4 rounded bg-warn-bg p-3 text-sm text-warn">
          Poslednji uvezen kurs je star {danasnji} dana. Automatski uvoz je verovatno zakazao —
          proverite ga, ili unesite kurs ručno ispod da naplata i izveštaji ne stanu.
        </p>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-faint">valuta:</span>
            <FilterLink label="sve" href="/finansije/kursna-lista" active={!searchParams?.currency} />
            <FilterLink
              label="EUR"
              href="/finansije/kursna-lista?currency=EUR"
              active={searchParams?.currency === 'EUR'}
            />
            <FilterLink
              label="USD"
              href="/finansije/kursna-lista?currency=USD"
              active={searchParams?.currency === 'USD'}
            />
          </div>

          {canEdit && (
            <div className="mb-4">
              <ExchangeRateForm />
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-border">
            {rates.length === 0 ? (
              <p className="p-4 text-center text-xs text-ink-faint">Nema unetih kurseva.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-panel2 text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2 text-left">datum</th>
                    <th className="px-4 py-2 text-left">valuta</th>
                    <th className="px-4 py-2 text-right">srednji kurs</th>
                    <th className="px-4 py-2 text-left">poreklo</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} className="border-b border-border bg-panel last:border-b-0">
                      <td className="px-4 py-2 font-mono text-ink">{formatirajDatum(r.rateDate)}</td>
                      <td className="px-4 py-2 text-ink">{r.currency}</td>
                      {/* `nbsMiddleRate` je STRING (Prisma Decimal kroz JSON, zamka 10.1) —
                          prikazuje se kakav jeste, bez pretvaranja u broj koje bi izgubilo
                          decimale. Zapeta umesto tačke je srpska konvencija za decimale. */}
                      <td className="px-4 py-2 text-right font-mono text-ink">
                        {String(r.nbsMiddleRate).replace('.', ',')}
                      </td>
                      <td className="px-4 py-2">
                        {r.source === 'NBS_API' ? (
                          <Badge variant="ok">NBS, automatski</Badge>
                        ) : (
                          <Badge variant="warn">ručno uneto</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            shown={rates.length}
            limit={limit}
            basePath="/finansije/kursna-lista"
            searchParams={(searchParams ?? {}) as Record<string, string | string[] | undefined>}
            itemLabel="kurseva"
          />
        </>
      )}
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded border px-2 py-0.5 ${
        active ? 'border-accent bg-accent-soft text-accent' : 'border-border text-ink-faint hover:text-accent'
      }`}
    >
      {label}
    </Link>
  );
}

function formatirajDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function danaOd(iso: string): number {
  const dan = new Date(iso);
  return Math.floor((Date.now() - dan.getTime()) / (24 * 60 * 60 * 1000));
}
