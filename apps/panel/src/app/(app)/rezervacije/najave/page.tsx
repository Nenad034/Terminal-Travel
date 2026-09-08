import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ManifestsClient, { type Manifest, type ChangeNotice } from './ManifestsClient';
import Pagination from '@/components/Pagination';

// M5 spec §8 (§8.4 priprema/slanje, §8.6 potvrda, §8.8 jedinstveno sanduče) — ekran „Najave
// dobavljačima", napravljen 5.9.2026 na zahtev vlasnika.
//
// ZAŠTO TEK SADA: ceo pozadinski deo (priprema nacrta, grupisanje po dobavljaču, slanje,
// potvrda) postoji od avgusta 2026, ali nijedan ekran ga nije pokretao — operativna lista se
// mogla poslati isključivo direktnim pozivom API-ja. Za operatera to znači da funkcija
// praktično nije postojala. Prekršaj vlasnikovog standing pravila iz CLAUDE.md („logika
// postoji, UI ne" je isto tako nezavršeno), otkriven revizijom koda kao sporedni nalaz uz
// dok. 39 nalaz 1.2.
//
// Server komponenta samo dovlači podatke i proverava dozvole; sve akcije su u
// `ManifestsClient.tsx`/`actions.ts`, isti obrazac kao ostatak panela.
export default async function SupplierNoticesPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canSend = hasPermission(me, 'M5', 'supplier-manifest', 'SEND');
  // Izmena/storno ima SOPSTVENU dozvolu (`supplier-change-notice/SEND`) — ne izvoditi je iz
  // dozvole za operativne liste, inače bi ekran nudio dugme koje API odbija sa 403.
  const canSendNotice = hasPermission(me, 'M5', 'supplier-change-notice', 'SEND');
  const canPrepare = hasPermission(me, 'M5', 'supplier-manifest', 'CREATE');
  const canConfirm = hasPermission(me, 'M5', 'supplier-confirmation', 'CONFIRM');

  let manifests: Manifest[] = [];
  let notices: ChangeNotice[] = [];
  // Razvrstavanje 8.9.2026 (dok. 27, nastavak nalaza 2.2) — oba endpointa sad vraćaju
  // `{ data, total, ... }`. "Najave čekaju slanje" (ispod) su uvek skorašnje (najsvežih
  // `generatedAt`/`createdAt` prva strana pokriva ih), pa granica ne skriva radnju koja čeka —
  // samo sprečava da istorija od stotina starih najava dođe u jednom odgovoru.
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let limit = 50;
  let error: string | null = null;
  try {
    const qs = searchParams?.page ? `?page=${searchParams.page}` : '';
    const [manifestsResult, noticesResult] = await Promise.all([
      apiFetch<{
        data: Manifest[];
        total: number;
        page: number;
        pageCount: number;
        limit: number;
      }>(`/sales/supplier-manifests${qs}`),
      apiFetch<{ data: ChangeNotice[] }>('/sales/supplier-change-notices?limit=200'),
    ]);
    manifests = manifestsResult.data;
    total = manifestsResult.total;
    page = manifestsResult.page;
    pageCount = manifestsResult.pageCount;
    limit = manifestsResult.limit;
    notices = noticesResult.data;
  } catch {
    error = 'Nemate dozvolu za uvid u najave dobavljačima (M5/supplier-manifest/VIEW).';
  }

  const waiting =
    manifests.filter((m) => m.status === 'PENDING_SEND').length +
    notices.filter((n) => n.status === 'PENDING_SEND').length;

  return (
    <div className="p-6">
      <RegisterTab label="Najave dobavljačima" />
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Najave dobavljačima</h1>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && waiting > 0 && (
        // Ovo je vidljiva posledica nalaza 1.2: ranije je „nije otišlo" izgledalo isto kao
        // „poslato". Sad se broji i stoji na vrhu, jer je to jedino stanje koje traži radnju.
        <p className="mb-4 flex items-center gap-1.5 rounded bg-warn-bg p-3 text-sm text-warn">
          <Icon name="warning" />
          {waiting === 1 ? 'Jedna najava čeka slanje' : `${waiting} najava čeka slanje`} — pokušaj
          je zabeležen, ali poruka nije otišla dobavljaču.
        </p>
      )}

      {!error && (
        <ManifestsClient
          manifests={manifests}
          notices={notices}
          canSend={canSend}
          canSendNotice={canSendNotice}
          canPrepare={canPrepare}
          canConfirm={canConfirm}
        />
      )}

      {!error && (
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          shown={manifests.length}
          limit={limit}
          basePath="/rezervacije/najave"
          searchParams={searchParams ?? {}}
          itemLabel="najava"
        />
      )}
    </div>
  );
}
