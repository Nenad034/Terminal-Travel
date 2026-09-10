import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import RazlikeReview, { type UgovorRazlike } from './RazlikeReview';

/** Sirov red uvoza — koristi se samo za brojače u zaglavlju (§4.2.10). */
interface UvozRed {
  id: string;
  reviewStatus: string;
}
import RetryButton from './RetryButton';

// M3 spec §4.2.2/§4.2.3/§4.2.4, M17 §6c — pregled redova koje je AI izvukao.
//
// Ovo je jedini ekran na kom cena iz cenovnika postaje stvarna cena u ugovoru, i to isključivo
// klikom čoveka (§4.2.4). AI je do ovde uradio dve stvari: pročitao tabelu i predložio poklapanje
// hotela — nijednu nije upisao.

export const dynamic = 'force-dynamic';

interface Uvoz {
  id: string;
  supplierId: string;
  sourceFormat: string;
  sourceText: string | null;
  sourceFileName: string | null;
  /** §4.2.7 — PARSER (tekst izvučen iz fajla) ili MODEL (sken/slika pročitana direktno). */
  extractionPath: 'PARSER' | 'MODEL' | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

export default async function UvozDetaljPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const me = await getMe();
  if (!hasPermission(me, 'M3', 'pricelist-import', 'VIEW')) {
    return (
      <div className="p-6">
        <RegisterTab label="Uvoz cenovnika" />
        <p className="rounded-lg border border-border bg-panel p-4 text-sm text-ink-dim">
          Nemate pravo uvida u uvoze cenovnika (M3/pricelist-import/VIEW).
        </p>
      </div>
    );
  }
  const canApprove = hasPermission(me, 'M3', 'pricelist-import', 'APPROVE_ROW');
  const canRetry = hasPermission(me, 'M3', 'pricelist-import', 'CREATE');

  const uvoz = await apiFetch<Uvoz>(`/contracting/pricelist-imports/${id}`);
  // §4.2.10 — ekran prikazuje RAZLIKE prema zatečenom cenovniku, ne sirove redove uvoza.
  // Redovi se i dalje dohvataju, ali samo da bi se videlo koliko ih je i koliko čeka odluku.
  const [redovi, razlike, dobavljaci] = await Promise.all([
    apiFetch<UvozRed[]>(`/contracting/pricelist-imports/${id}/rows`).catch(() => [] as UvozRed[]),
    apiFetch<{
      ugovori: UgovorRazlike[];
      nepoklopljeni: { rowId: string; hotel: string; matchConfidence: number | null }[];
    }>(`/contracting/pricelist-imports/${id}/razlike`).catch(() => ({
      ugovori: [] as UgovorRazlike[],
      nepoklopljeni: [] as { rowId: string; hotel: string; matchConfidence: number | null }[],
    })),
    apiFetch<{ data: { id: string; name: string }[] }>('/contracting/suppliers?limit=200')
      .then((r) => r.data)
      .catch(() => []),
  ]);

  const dobavljac = dobavljaci.find((d) => d.id === uvoz.supplierId);

  const cekaju = redovi.filter((r) => r.reviewStatus === 'PENDING').length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <RegisterTab label={`Uvoz — ${dobavljac?.name ?? uvoz.supplierId}`} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/cenovnici" className="text-[11px] text-accent-strong hover:underline">
            ← svi uvozi
          </Link>
          <h1 className="text-lg font-semibold text-ink">{dobavljac?.name ?? uvoz.supplierId}</h1>
          <p className="text-xs text-ink-faint">
            {new Date(uvoz.createdAt).toLocaleString('sr-RS')} · {uvoz.sourceFormat} ·{' '}
            {redovi.length} {redovi.length === 1 ? 'red' : 'redova'}
            {cekaju > 0 && ` · ${cekaju} čeka odluku`}
            {uvoz.sourceFileName && ` · ${uvoz.sourceFileName}`}
          </p>
        </div>
        {uvoz.status === 'FAILED' && canRetry && <RetryButton importId={uvoz.id} />}
      </div>

      {uvoz.failureReason && (
        <p className="rounded-lg bg-danger-bg p-3 text-xs text-danger">
          <strong>Uvoz nije uspeo.</strong> {uvoz.failureReason}
        </p>
      )}

      {redovi.length > 0 && (
        <p className="rounded-lg bg-sunken p-3 text-[11px] text-ink-faint">
          <Icon name="sparkle" /> AI je pročitao tabelu i predložio poklapanje sa katalogom.{' '}
          <strong className="text-ink">Ništa još nije upisano u cenovnik.</strong> Potvrda reda
          pravi period ugovora i cenovnu stavku — proverite iznos i period pre nego što potvrdite.
        </p>
      )}

      <RazlikeReview
        importId={uvoz.id}
        ugovori={razlike.ugovori}
        nepoklopljeni={razlike.nepoklopljeni}
        canApprove={canApprove}
      />

      {/*
        §4.2.7 — ko je pročitao sadržaj stoji na ekranu, ne samo u bazi. „AI je čitao sken"
        objašnjava i zašto je taj uvoz skuplji i zašto redovi mogu biti manje pouzdani nego kod
        fajla iz kog je tekst izvučen deterministički.
      */}
      {uvoz.extractionPath === 'MODEL' && (
        <p className="rounded-lg bg-sunken p-3 text-[11px] text-ink-faint">
          <Icon name="sparkle" /> Iz ovog fajla nije se mogao izvući tekst (skeniran dokument ili
          slika), pa ga je <strong className="text-ink">AI čitao direktno</strong>. Proverite iznose
          pažljivije nego obično — čitanje sa slike greši češće nego čitanje teksta.
        </p>
      )}

      {uvoz.sourceText && (
        <details className="rounded-lg border border-border bg-panel p-3">
          <summary className="cursor-pointer text-xs font-medium text-ink">
            Izvorni tekst koji je AI čitao
          </summary>
          {/* Izvor stoji uz rezultat namerno: bez njega se ne može proveriti da li je AI nešto
              pogrešno pročitao ili je tako i pisalo u cenovniku. */}
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-sunken p-2 font-mono text-[11px] text-ink-dim">
            {uvoz.sourceText}
          </pre>
        </details>
      )}
    </div>
  );
}
