'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  prepareForBooking,
  sendManifest,
  confirmManifest,
  sendChangeNotice,
  confirmChangeNotice,
  emptyState,
  type FormState,
} from './actions';

export interface Manifest {
  id: string;
  status: 'DRAFT' | 'PENDING_SEND' | 'SENT' | 'SUPERSEDED';
  referenceCode: string | null;
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  sentAt: string | null;
  sentToEmail: string | null;
  supplier: { id: string; name: string; contactEmail: string } | null;
  _count?: { items: number };
}

export interface ChangeNotice {
  id: string;
  status: 'DRAFT' | 'PENDING_SEND' | 'SENT';
  noticeType: 'MODIFICATION' | 'CANCELLATION';
  referenceCode: string;
  createdAt: string;
  sentAt: string | null;
  supplierConfirmedAt: string | null;
  bookingItem: {
    id: string;
    stayFrom: string | null;
    stayTo: string | null;
    booking: { id: string; bookingNumber: string } | null;
    product: { type: string; destinationCity: string; sourceContract: { supplier: { id: string; name: string; contactEmail: string } | null } | null } | null;
  } | null;
}

// M5 spec §8 — ekran „Najave dobavljačima" (5.9.2026). Dve tabele jer su to dva različita
// posla iz istog poglavlja: rutinska operativna lista (§8.1–8.4) i pojedinačna izmena/storno
// (§8.8), koji NE čeka sledeću rutinsku listu jer dobavljač mora eksplicitno da sazna.
export default function ManifestsClient({
  manifests,
  notices,
  canSend,
  canSendNotice,
  canPrepare,
  canConfirm,
}: {
  manifests: Manifest[];
  notices: ChangeNotice[];
  canSend: boolean;
  canSendNotice: boolean;
  canPrepare: boolean;
  canConfirm: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {canPrepare && <PrepareForm />}

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="list-unordered" className="text-accent" /> Operativne liste
          <span className="text-xs font-normal text-ink-faint">({manifests.length})</span>
        </h2>
        {manifests.length === 0 ? (
          <EmptyHint text="Nema pripremljenih lista. Pripremite ih za konkretnu rezervaciju gore, ili sačekajte periodičnu pripremu." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>oznaka</TableHead>
                <TableHead>dobavljač</TableHead>
                <TableHead>period</TableHead>
                <TableHead className="text-right">stavki</TableHead>
                <TableHead>status</TableHead>
                <TableHead>radnja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manifests.map((m) => (
                <TableRow key={m.id} className="last:border-0">
                  <TableCell className="font-mono text-ink">{m.referenceCode ?? '—'}</TableCell>
                  <TableCell>
                    <div className="text-ink-dim">{m.supplier?.name ?? '—'}</div>
                    <div className="text-[11px] text-ink-faint">{m.sentToEmail ?? m.supplier?.contactEmail ?? ''}</div>
                  </TableCell>
                  <TableCell className="text-ink-faint">
                    {formatDate(m.periodFrom)} – {formatDate(m.periodTo)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-ink-dim">{m._count?.items ?? '—'}</TableCell>
                  <TableCell>
                    <ManifestStatus status={m.status} sentAt={m.sentAt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* §8.4 — PENDING_SEND se sme poslati ponovo; SENT ne (ta lista je otišla). */}
                      {canSend && (m.status === 'DRAFT' || m.status === 'PENDING_SEND') && (
                        <ActionButton
                          action={sendManifest.bind(null, m.id)}
                          label={m.status === 'PENDING_SEND' ? 'pošalji ponovo' : 'pošalji'}
                          pendingLabel="Šaljem…"
                        />
                      )}
                      {canConfirm && m.status === 'SENT' && (
                        <ActionButton action={confirmManifest.bind(null, m.id)} label="dobavljač je potvrdio" pendingLabel="Upisujem…" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="warning" className="text-accent" /> Izmene i storna
          <span className="text-xs font-normal text-ink-faint">({notices.length})</span>
        </h2>
        <p className="mb-2 text-[11px] text-ink-faint">
          Izmena i storno ne čekaju sledeću rutinsku listu — dobavljač mora eksplicitno da sazna (M5 §8.8).
        </p>
        {notices.length === 0 ? (
          <EmptyHint text="Nema najava izmene ili storna." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>oznaka</TableHead>
                <TableHead>vrsta</TableHead>
                <TableHead>rezervacija</TableHead>
                <TableHead>dobavljač</TableHead>
                <TableHead>status</TableHead>
                <TableHead>radnja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.map((n) => {
                const supplier = n.bookingItem?.product?.sourceContract?.supplier ?? null;
                return (
                  <TableRow key={n.id} className="last:border-0">
                    <TableCell className="font-mono text-ink">{n.referenceCode}</TableCell>
                    <TableCell>
                      <Badge variant={n.noticeType === 'CANCELLATION' ? 'danger' : 'warn'}>
                        {n.noticeType === 'CANCELLATION' ? 'storno' : 'izmena'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-ink-dim">{n.bookingItem?.booking?.bookingNumber ?? '—'}</TableCell>
                    <TableCell>
                      <div className="text-ink-dim">{supplier?.name ?? '—'}</div>
                      <div className="text-[11px] text-ink-faint">{supplier?.contactEmail ?? ''}</div>
                    </TableCell>
                    <TableCell>
                      <NoticeStatus status={n.status} confirmedAt={n.supplierConfirmedAt} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {canSendNotice && (n.status === 'DRAFT' || n.status === 'PENDING_SEND') && (
                          <ActionButton
                            action={sendChangeNotice.bind(null, n.id, supplier?.contactEmail ?? '')}
                            label={n.status === 'PENDING_SEND' ? 'pošalji ponovo' : 'pošalji'}
                            pendingLabel="Šaljem…"
                          />
                        )}
                        {canConfirm && n.status === 'SENT' && !n.supplierConfirmedAt && (
                          <ActionButton action={confirmChangeNotice.bind(null, n.id)} label="dobavljač je potvrdio" pendingLabel="Upisujem…" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

/**
 * Statusi se prevode na jezik posla, ne na imena iz baze. `PENDING_SEND` posebno — cela svrha
 * tog statusa (M5 §8.4, uveden 5.9.2026) je da čovek VIDI da poruka nije otišla; da ovde piše
 * samo „poslato", status ne bi vredeo ništa.
 */
function ManifestStatus({ status, sentAt }: { status: Manifest['status']; sentAt: string | null }) {
  if (status === 'SENT') return <Badge variant="ok" title={sentAt ? `poslato ${formatDateTime(sentAt)}` : undefined}>poslato</Badge>;
  if (status === 'PENDING_SEND')
    return (
      <Badge variant="warn" title="Pokušaj je zabeležen, ali poruka nije otišla. Stavke NISU najavljene.">
        <Icon name="warning" /> čeka slanje
      </Badge>
    );
  if (status === 'SUPERSEDED') return <Badge variant="outline">zamenjena novijom</Badge>;
  return <Badge variant="secondary">nacrt</Badge>;
}

function NoticeStatus({ status, confirmedAt }: { status: ChangeNotice['status']; confirmedAt: string | null }) {
  if (confirmedAt) return <Badge variant="ok">dobavljač potvrdio</Badge>;
  if (status === 'SENT') return <Badge variant="ok">poslato</Badge>;
  if (status === 'PENDING_SEND')
    return (
      <Badge variant="warn" title="Pokušaj je zabeležen, ali poruka nije otišla.">
        <Icon name="warning" /> čeka slanje
      </Badge>
    );
  return <Badge variant="secondary">nacrt</Badge>;
}

/** §8.4 ad-hoc priprema — sistem sam grupiše po dobavljaču, operater ne mora da zna koji su. */
function PrepareForm() {
  const [state, formAction] = useActionState(prepareForBooking, emptyState);
  return (
    <form action={formAction} className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="add" className="text-accent" /> Pripremi nacrte za rezervaciju
      </div>
      <p className="mb-2 text-[11px] text-ink-faint">
        Ako rezervacija ima stavke od više dobavljača, nastaje po jedan nacrt za svakog. Priprema nikad ne šalje ništa.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input name="bookingId" required placeholder="ID rezervacije" className="input w-[22rem] font-mono text-xs" />
        <PrepareSubmit />
      </div>
      {state.error && <p className="mt-2 rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      {state.notice && <p className="mt-2 rounded bg-panel2 p-2 text-[11px] text-ink-dim">{state.notice}</p>}
    </form>
  );
}

function PrepareSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Pripremam…' : 'pripremi'}
    </Button>
  );
}

/** Jedno dugme + poruka ishoda; ishod se prikazuje jer „poslato" i „nije otišlo" izgledaju isto. */
function ActionButton({
  action,
  label,
  pendingLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, emptyState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <SmallSubmit label={label} pendingLabel={pendingLabel} />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
      {state.notice && <span className="text-[11px] text-ink-faint">{state.notice}</span>}
    </form>
  );
}

function SmallSubmit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      size="sm"
      className="h-auto border-accent px-2 py-0.5 text-[11px] text-accent-strong hover:bg-accent-soft"
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded border border-dashed border-border p-3 text-xs text-ink-faint">{text}</p>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sr-RS');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('sr-RS');
}
