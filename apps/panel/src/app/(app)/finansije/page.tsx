import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { ApproveButton, PayButton } from './SupplierObligationActions';
import { Badge } from '@/components/ui/badge';


interface Mismatch {
  bookingId: string;
  reason: 'MISSING_FISCAL_DOCUMENT' | 'PARTIAL_PAYMENT_STALE';
}

interface SupplierObligation {
  id: string;
  supplierId: string;
  bookingItemId: string | null;
  amountOriginal: number;
  currencyOriginal: string;
  dueDate: string;
  status: string;
}

interface ClientPaymentSchedule {
  bookingId: string;
  depositAmount: number;
  depositDueDate: string;
  depositStatus: string;
  balanceDueDate: string;
  balanceStatus: string;
}

// M17 spec §4/§7 (Faza 2) — "Finansije (fakture, plaćanja)", M10. Izlazni kriterijum M17 Faza 2:
// "Računovođa može da pripremi i pošalje fiskalni dokument" — konkretna radnja živi na stranici
// rezervacije (rezervacije/[id], M17 spec §2 — kompozicija na nivou prikaza), jer M10 API nema
// samostalan "lista svih fiskalnih dokumenata" endpoint (samo GET po id, poglavlje 10 M10 spec)
// — ovaj dashboard sastavlja ono što M10 API STVARNO izlaže kao liste: rekonsilijacija (§5.3),
// obaveze prema dobavljačima (§8), rokovi naplate od gosta (§5.4).
export default async function FinansijePage() {
  const me = await getMe();
  const canViewFiscal = hasPermission(me, 'M10', 'fiscal-document', 'VIEW');
  const canViewObligations = hasPermission(me, 'M10', 'supplier-obligation', 'VIEW');
  const canApproveObligations = hasPermission(me, 'M10', 'supplier-obligation', 'APPROVE');
  const canViewSchedules = hasPermission(me, 'M10', 'client-payment-schedule', 'VIEW');

  const [mismatches, obligations, schedules] = await Promise.all([
    canViewFiscal ? apiFetch<Mismatch[]>('/finance/reconciliation/mismatches').catch(() => null) : Promise.resolve(null),
    canViewObligations ? apiFetch<SupplierObligation[]>('/finance/supplier-obligations').catch(() => null) : Promise.resolve(null),
    canViewSchedules ? apiFetch<ClientPaymentSchedule[]>('/finance/client-payment-schedules').catch(() => null) : Promise.resolve(null),
  ]);

  const noAccess = !canViewFiscal && !canViewObligations && !canViewSchedules;

  return (
    <div className="p-6">
      <RegisterTab label="Finansije" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> ls finansije/
        </h1>
        <p className="text-xs text-ink-dim">
          Fiskalni dokumenti se pripremaju/šalju sa stranice pojedinačne rezervacije. Ovde je pregled onoga što zahteva pažnju Računovođe.
        </p>
      </div>

      {noAccess && <p className="rounded bg-danger-bg p-3 text-sm text-danger">Nemate dozvolu za uvid u finansijske podatke.</p>}

      {canViewFiscal && (
        <Section icon="warning" title="Rekonsilijacija — potvrđene rezervacije koje zahtevaju pažnju (M10 §5.3)">
          {mismatches === null ? (
            <ErrorRow />
          ) : mismatches.length === 0 ? (
            <EmptyRow text="Nema neusklađenosti." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {mismatches.map((m) => (
                <TabLink
                  key={m.bookingId}
                  href={`/rezervacije/${m.bookingId}`}
                  label={`rezervacija ${m.bookingId.slice(0, 8)}…`}
                  className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
                >
                  <span className="font-medium text-ink">rezervacija {m.bookingId.slice(0, 8)}…</span>
                  <Badge variant="warn">{m.reason === 'MISSING_FISCAL_DOCUMENT' ? 'nedostaje fiskalni dokument' : 'delimično plaćeno, predugo'}</Badge>
                </TabLink>
              ))}
            </div>
          )}
        </Section>
      )}

      {canViewObligations && (
        <Section icon="briefcase" title="Obaveze prema dobavljačima (M10 §8)">
          {obligations === null ? (
            <ErrorRow />
          ) : obligations.length === 0 ? (
            <EmptyRow text="Nema obaveza prema dobavljačima." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {obligations.map((o) => {
                const overdue = new Date(o.dueDate) < new Date() && o.status !== 'PAID';
                return (
                  <div key={o.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                    <div>
                      <div className="font-medium text-ink">
                        {(o.amountOriginal / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {o.currencyOriginal}
                        {!o.bookingItemId && <span className="ml-2 text-[11px] text-danger">(neuparena stavka)</span>}
                      </div>
                      <div className={`text-xs ${overdue ? 'text-danger' : 'text-ink-faint'}`}>
                        rok: {new Date(o.dueDate).toLocaleDateString('sr-RS')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      {canApproveObligations && o.status === 'PENDING' && o.bookingItemId && <ApproveButton id={o.id} />}
                      {canApproveObligations && o.status === 'APPROVED' && <PayButton id={o.id} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {canViewSchedules && (
        <Section icon="calendar" title="Rokovi naplate od gosta/nalogodavca (M10 §5.4)">
          {schedules === null ? (
            <ErrorRow />
          ) : schedules.length === 0 ? (
            <EmptyRow text="Nema aktivnih rasporeda naplate." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {schedules
                .filter((s) => s.depositStatus === 'OVERDUE' || s.balanceStatus === 'OVERDUE')
                .map((s) => (
                  <TabLink
                    key={s.bookingId}
                    href={`/rezervacije/${s.bookingId}`}
                    label={`rezervacija ${s.bookingId.slice(0, 8)}…`}
                    className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
                  >
                    <span className="font-medium text-ink">rezervacija {s.bookingId.slice(0, 8)}…</span>
                    <Badge variant="danger">{s.depositStatus === 'OVERDUE' ? 'akontacija probijena' : 'balans probijen'}</Badge>
                  </TabLink>
                ))}
              {schedules.every((s) => s.depositStatus !== 'OVERDUE' && s.balanceStatus !== 'OVERDUE') && (
                <p className="p-4 text-center text-xs text-ink-faint">Nema probijenih rokova naplate.</p>
              )}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name={icon} className="text-accent" /> {title}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PAID') return <Badge variant="ok">{status}</Badge>;
  if (status === 'DISPUTED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">{text}</p>;
}

function ErrorRow() {
  return <p className="rounded bg-danger-bg p-3 text-xs text-danger">Nemate dozvolu ili podaci trenutno nisu dostupni.</p>;
}
