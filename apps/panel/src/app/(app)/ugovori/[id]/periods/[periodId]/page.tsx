import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import { Badge } from '@/components/ui/badge';
import RateLinesPanel, { type RateLine } from './RateLinesPanel';
import CancellationRulesPanel, { type CancellationRule } from './CancellationRulesPanel';
import OffersPanel, { type PricelistOffer } from './OffersPanel';
import AncillaryServicesPanel, { type AncillaryService } from './AncillaryServicesPanel';
import TouristTaxPanel, { type TouristTaxInfo } from './TouristTaxPanel';


type AllotmentMode = 'FIXED' | 'ON_REQUEST' | 'CHARTER' | 'FIXED_LEASE';

interface AgePolicyOverrideEntry {
  category: string;
  ageFrom: number;
  ageTo: number | null;
  countsTowardCapacity: boolean;
}

interface ContractPeriodDetail {
  id: string;
  contractId: string;
  stayFrom: string;
  stayTo: string;
  roomType: string;
  allotmentMode: AllotmentMode;
  totalCapacity: number | null;
  unitsSold: number;
  releaseDaysBefore: number | null;
  ukupnaFiksnaObaveza: number | null;
  fixedObligationCurrency: string | null;
  agePolicyOverride: AgePolicyOverrideEntry[] | null;
  minStayNights: number | null;
  maxStayNights: number | null;
  rateLines: RateLine[];
  cancellationRules: CancellationRule[];
  offers: PricelistOffer[];
  ancillaryServices: AncillaryService[];
  touristTaxInfo: TouristTaxInfo | null;
}

const MODE_LABELS: Record<AllotmentMode, string> = { FIXED: 'Fiksni alotman', ON_REQUEST: 'Na upit', CHARTER: 'Čarter', FIXED_LEASE: 'Fiksni zakup' };

// M3 spec §2.4/§2.4a/§2.5 — cenovne stavke i pravila otkazivanja po periodu, poslednji deo
// gap-a "panel ekran za pojedinačan ugovor/period ne postoji" (backlog M3 sekcija, 28.8.2026).
export default async function ContractPeriodDetailPage(props: { params: Promise<{ id: string; periodId: string }> }) {
  const params = await props.params;
  const me = await getMe();
  const canEdit = hasPermission(me, 'M3', 'contract-period', 'EDIT');

  const period = await apiFetch<ContractPeriodDetail>(`/contracting/contracts/${params.id}/periods/${params.periodId}`);

  return (
    <div className="p-6">
      <RegisterTab label={`${period.roomType} — period`} />
      <h1 className="mb-1 text-lg font-semibold text-ink">{`${period.roomType} — period`}</h1>
      <p className="mb-4 text-xs text-ink-faint">
        {new Date(period.stayFrom).toLocaleDateString('sr-RS')} – {new Date(period.stayTo).toLocaleDateString('sr-RS')} ·{' '}
        <Badge variant="secondary">{MODE_LABELS[period.allotmentMode]}</Badge>
      </p>

      <div className="mb-4 rounded-lg border border-border bg-panel p-5 text-xs">
        <dl className="grid grid-cols-3 gap-3">
          {period.totalCapacity != null ? (
            <>
              <div>
                <dt className="text-ink-faint">Ukupan kapacitet</dt>
                <dd className="mt-0.5 text-ink">{period.totalCapacity}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Prodato</dt>
                <dd className="mt-0.5 text-ink">{period.unitsSold}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Preostalo</dt>
                <dd className="mt-0.5 text-ink">{period.totalCapacity - period.unitsSold}</dd>
              </div>
            </>
          ) : (
            <div className="col-span-3">
              <dt className="text-ink-faint">Kapacitet</dt>
              <dd className="mt-0.5 text-ink">Bez garantovanog kapaciteta — svaka rezervacija čeka potvrdu dobavljača (M3 spec §2.3).</dd>
            </div>
          )}
          {period.releaseDaysBefore != null && (
            <div>
              <dt className="text-ink-faint">Rok povrata alotmana</dt>
              <dd className="mt-0.5 text-ink">{period.releaseDaysBefore} dana pre stay_from</dd>
            </div>
          )}
          {(period.minStayNights != null || period.maxStayNights != null) && (
            <div>
              <dt className="text-ink-faint">Broj noćenja</dt>
              <dd className="mt-0.5 text-ink">
                {period.minStayNights != null ? `min ${period.minStayNights}` : ''}
                {period.minStayNights != null && period.maxStayNights != null ? ' · ' : ''}
                {period.maxStayNights != null ? `max ${period.maxStayNights}` : ''}
              </dd>
            </div>
          )}
          {period.ukupnaFiksnaObaveza != null && (
            <div>
              <dt className="text-ink-faint">Ukupna fiksna obaveza</dt>
              <dd className="mt-0.5 text-ink">
                {period.ukupnaFiksnaObaveza} {period.fixedObligationCurrency}
              </dd>
            </div>
          )}
        </dl>

        {period.agePolicyOverride && period.agePolicyOverride.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <dt className="mb-1 text-ink-faint">Uzrasna politika — izuzetak za ovaj period (M3 spec §2.3c)</dt>
            <dd className="flex flex-wrap gap-1.5">
              {period.agePolicyOverride.map((ap, i) => (
                <Badge key={i} variant="outline">
                  {ap.category}: {ap.ageFrom}–{ap.ageTo ?? '∞'}
                </Badge>
              ))}
            </dd>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RateLinesPanel contractId={params.id} periodId={params.periodId} rateLines={period.rateLines} canEdit={canEdit} />
        <CancellationRulesPanel contractId={params.id} periodId={params.periodId} rules={period.cancellationRules} canEdit={canEdit} />
        <OffersPanel contractId={params.id} periodId={params.periodId} offers={period.offers} canEdit={canEdit} />
        <AncillaryServicesPanel contractId={params.id} periodId={params.periodId} services={period.ancillaryServices} canEdit={canEdit} />
        <TouristTaxPanel contractId={params.id} periodId={params.periodId} taxInfo={period.touristTaxInfo} canEdit={canEdit} />
      </div>
    </div>
  );
}
