import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NewMailboxForm from './NewMailboxForm';
import GrantAccessForm from './GrantAccessForm';

interface Mailbox {
  id: string;
  address: string;
  displayName: string;
  mailboxType: 'SHARED' | 'PERSONAL';
  ownerUserId: string | null;
  isSupplierUnifiedInbox: boolean;
  status: string;
}

interface MailboxAccessRow {
  id: string;
  mailboxId: string;
  userId: string;
  accessLevel: 'VIEW' | 'REPLY';
  grantedBy: string;
  grantedAt: string;
}

// M22 spec §2.1/§2.2/§7 — upravljanje sandučadima (M22/mailbox/{VIEW,CREATE}) i pojedinačna
// dodela pristupa (M22/mailbox-access/GRANT) — obe uže dozvole, podrazumevano Vlasnik/Direktor
// (§7), za razliku od pregleda niti koji je po pojedinačnom MailboxAccess (§2.2, glavni /email
// ekran).
export default async function MailboxManagementPage() {
  const me = await getMe();
  const canView = hasPermission(me, 'M22', 'mailbox', 'VIEW');
  const canCreate = hasPermission(me, 'M22', 'mailbox', 'CREATE');
  const canGrant = hasPermission(me, 'M22', 'mailbox-access', 'GRANT');

  let mailboxes: Mailbox[] = [];
  let error: string | null = null;
  if (canView) {
    try {
      mailboxes = await apiFetch<Mailbox[]>('/email/mailboxes');
    } catch {
      error = 'Pribavljanje sandučadi nije uspelo.';
    }
  } else {
    error = 'Nemate dozvolu za uvid u sandučad (M22/mailbox/VIEW) — upravljanje sandučadima je ograničeno na Vlasnika/Direktora.';
  }

  const accessByMailbox = new Map<string, MailboxAccessRow[]>();
  if (canGrant && !error) {
    await Promise.all(
      mailboxes.map(async (mb) => {
        try {
          accessByMailbox.set(mb.id, await apiFetch<MailboxAccessRow[]>(`/email/mailboxes/${mb.id}/access`));
        } catch {
          accessByMailbox.set(mb.id, []);
        }
      }),
    );
  }

  return (
    <div className="p-6">
      <RegisterTab label="Sandučad" />
      <Link href="/email" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na inbox
      </Link>

      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> ls email/sanducad/
        </h1>
        <p className="text-xs text-ink-dim">Upravljanje sandučadima i pojedinačna dodela pristupa — M22 spec §2.1/§2.2.</p>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && canCreate && (
        <div className="mb-4">
          <NewMailboxForm />
        </div>
      )}

      {!error && (
        <div className="flex flex-col gap-3">
          {mailboxes.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema sandučadi.</p>}
          {mailboxes.map((mb) => (
            <div key={mb.id} className="rounded-lg border border-border bg-panel p-4">
              <div className="text-sm font-medium text-ink">
                {mb.displayName} <span className="text-ink-faint">({mb.address})</span>
                {mb.isSupplierUnifiedInbox && (
                  <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-strong">jedinstveno sanduče dobavljača</span>
                )}
              </div>
              <div className="text-xs text-ink-faint">
                {mb.mailboxType} · {mb.status}
                {mb.ownerUserId && ` · vlasnik: ${mb.ownerUserId}`}
              </div>

              {canGrant && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 text-xs font-semibold text-ink">Pristup (MailboxAccess)</div>
                  {(accessByMailbox.get(mb.id) ?? []).length === 0 ? (
                    <p className="mb-2 text-[11px] text-ink-faint">Niko dodatno nema dodeljen pristup (vlasnik ličnog sandučeta ga dobija automatski).</p>
                  ) : (
                    <div className="mb-2 flex flex-col gap-1">
                      {(accessByMailbox.get(mb.id) ?? []).map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded bg-panel2 px-2 py-1 text-[11px]">
                          <span className="text-ink-dim">{a.userId}</span>
                          <span className="text-ink-faint">
                            {a.accessLevel} · dodelio {a.grantedBy}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <GrantAccessForm mailboxId={mb.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
