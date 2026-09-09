import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import PricelistGrid, { type Mreza } from './PricelistGrid';
import SeasonsBar from './SeasonsBar';
import SurchargesPanel, { type Doplata } from './SurchargesPanel';
import Kartice from './Kartice';
import PricingRulesPanel, { type PravilioRed } from './PricingRulesPanel';
import VerzijePanel, { type RazlikeOdgovor, type Verzija } from './VerzijePanel';
import KalendarPanel from './KalendarPanel';

/**
 * M3 spec §2.11, M17 §6d — cenovnik jednog ugovora kao mreža.
 *
 * Zamenjuje put „ugovor → period → cenovne stavke", u kom se za hotel sa 5 tipova soba i 6
 * sezona ulazilo na 30 odvojenih ekrana. Sve tri pročitane forme stvarnih cenovnika (Aycon,
 * Plava Laguna, Solvex) imaju isti oblik koji ovaj ekran ponavlja: tipovi soba kao redovi,
 * sezone kao kolone.
 */
export const dynamic = 'force-dynamic';

interface Ugovor {
  id: string;
  contractNumber: string;
  supplierId: string;
}

export default async function CenovnikPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const me = await getMe();

  if (!hasPermission(me, 'M3', 'contract-period', 'VIEW')) {
    return (
      <div className="p-6">
        <RegisterTab label="Cenovnik" />
        <p className="rounded-lg border border-border bg-panel p-4 text-sm text-ink-dim">
          Nemate pravo uvida u cenovnike (M3/contract-period/VIEW).
        </p>
      </div>
    );
  }
  const canEdit = hasPermission(me, 'M3', 'contract-period', 'EDIT');

  const [mreza, ugovor, doplate, pravila, verzije, razlike] = await Promise.all([
    apiFetch<Mreza>(`/contracting/contracts/${id}/pricelist-grid`),
    apiFetch<Ugovor>(`/contracting/contracts/${id}`).catch(() => null),
    apiFetch<Doplata[]>(`/contracting/contracts/${id}/pricelist-surcharges`).catch(
      () => [] as Doplata[],
    ),
    apiFetch<PravilioRed[]>(`/contracting/contracts/${id}/pricing-rules`).catch(
      () => [] as PravilioRed[],
    ),
    // §2.11l — verzije cenovnika. `catch` daje prazan spisak umesto pada cele strane: ugovor
    // bez ijedne verzije je uobičajeno stanje, ne greška.
    apiFetch<{ versions: Verzija[] }>(`/contracting/contracts/${id}/pricelist-versions`).catch(
      () => ({ versions: [] as Verzija[] }),
    ),
    apiFetch<RazlikeOdgovor>(`/contracting/contracts/${id}/pricelist-versions/razlike`).catch(
      () =>
        ({
          poslednjaVerzija: null,
          sledecaVerzija: 1,
          razlike: [],
          ukupno: 0,
          stavkiUCenovniku: 0,
        }) as RazlikeOdgovor,
    ),
  ]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <RegisterTab label={`Cenovnik — ${mreza.contractNumber}`} />

      <div>
        <Link href={`/ugovori/${id}`} className="text-[11px] text-accent-strong hover:underline">
          ← ugovor
        </Link>
        <h1 className="text-lg font-semibold text-ink">Cenovnik {mreza.contractNumber}</h1>
        <p className="text-xs text-ink-faint">
          Valuta <strong className="text-ink">{mreza.currency}</strong>
          {mreza.commissionModel && (
            <>
              {' · '}
              cenovnik je{' '}
              <strong className="text-ink">
                {mreza.commissionModel === 'NET' ? 'neto' : 'sa provizijom'}
              </strong>
              {mreza.commissionPercentage != null && ` ${mreza.commissionPercentage}%`}
            </>
          )}
          {ugovor && ' · '}
          {mreza.seasons.length} {mreza.seasons.length === 1 ? 'sezona' : 'sezona'}
        </p>
      </div>

      <SeasonsBar contractId={id} seasons={mreza.seasons} canEdit={canEdit} />

      {mreza.seasons.length === 0 ? (
        // Prazna mreža bez sezona nije greška nego redosled posla — sezone su kolone, pa bez
        // njih nema gde da se upiše cena. Ekran to kaže umesto da prikaže praznu tabelu.
        <p className="rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-faint">
          Ovaj ugovor još nema nijednu sezonu. Sezone su kolone cenovnika — dodajte prvu iznad, pa
          se ispod pojavljuje mreža za unos cena.
        </p>
      ) : (
        // Redosled kartica je vlasnikov (9.9.2026): prvo cene, pa doplate i popusti.
        <Kartice
          cene={<PricelistGrid contractId={id} mreza={mreza} canEdit={canEdit} />}
          doplate={
            <SurchargesPanel
              contractId={id}
              doplate={doplate}
              seasons={mreza.seasons}
              tipoviSoba={mreza.roomTypes.map((g) => g.roomType)}
              currency={mreza.currency}
              canEdit={canEdit}
            />
          }
          brojDoplata={doplate.length}
          pravila={
            <PricingRulesPanel
              contractId={id}
              pravila={pravila}
              currency={mreza.currency}
              podrazumevanaMarza={null}
              canEdit={canEdit}
            />
          }
          brojIzuzetaka={pravila.filter((p) => p.jeIzuzetak).length}
          verzije={
            <VerzijePanel
              contractId={id}
              verzije={verzije.versions}
              razlike={razlike}
              currency={mreza.currency}
              canEdit={canEdit}
            />
          }
          brojRazlika={razlike.ukupno}
          kalendar={
            <KalendarPanel
              contractId={id}
              tipoviSoba={mreza.roomTypes.map((g) => g.roomType)}
              currency={mreza.currency}
            />
          }
        />
      )}
    </div>
  );
}
