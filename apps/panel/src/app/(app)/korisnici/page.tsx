import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


interface UserRow {
  id: string;
  fullName: string;
  email: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: { role: { id: string; name: string } }[];
}

// M1 spec §7 — GET /iam/users. Pretraga (ime/email) ide klijentski nad punom listom, isti
// obrazac kao ostatak M17 kad API nema poseban filter parametar za taj resurs.
export default async function KorisniciPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canCreate = hasPermission(me, 'M1', 'user', 'CREATE');

  let users: UserRow[] = [];
  let error: string | null = null;
  try {
    users = await apiFetch<UserRow[]>('/iam/users');
  } catch {
    error = 'Nemate dozvolu za uvid u korisnike (M1/user/VIEW).';
  }

  const q = searchParams?.q?.toLowerCase().trim();
  const filtered = q ? users.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;

  return (
    <div className="p-6">
      <RegisterTab label="Korisnici i uloge" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls korisnici/
          </h1>
          <p className="text-xs text-ink-dim">Nalozi internog tima, dodeljene uloge, status i 2FA — M1.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/korisnici/uloge" className="flex items-center gap-1.5">
              <Icon name="organization" /> uloge
            </Link>
          </Button>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/korisnici/novi" className="flex items-center gap-1.5">
                <Icon name="add" /> pozovi korisnika
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!error && (
        <form className="mb-3 flex gap-2 text-xs" action="/korisnici">
          <input name="q" defaultValue={searchParams?.q ?? ''} placeholder="pretraga po imenu ili email-u" className="input flex-1" />
          <Button type="submit" variant="secondary" size="sm">
            traži
          </Button>
          {searchParams?.q && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/korisnici">obriši filter</Link>
            </Button>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="rounded-lg border border-border bg-panel">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Ime</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Uloge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead>Poslednja prijava</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="cursor-pointer">
                  <TableCell className="p-0">
                    <TabLink href={`/korisnici/${u.id}`} label={u.fullName} className="flex h-full w-full items-center px-3.5 py-2.5 font-medium text-ink">
                      {u.fullName}
                    </TabLink>
                  </TableCell>
                  <TableCell className="text-ink-faint">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-ink-faint">—</span>}
                      {u.roles.map((r) => (
                        <Badge key={r.role.id} variant="secondary" className="text-ink-faint">
                          {r.role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                  </TableCell>
                  <TableCell>{u.mfaEnabled ? <Badge variant="ok">uključeno</Badge> : <Badge variant="warn">isključeno</Badge>}</TableCell>
                  <TableCell className="text-ink-faint">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('sr-RS') : 'nikad'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-6 text-center text-ink-faint">
                    Nema korisnika za zadatu pretragu.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UserRow['status'] }) {
  if (status === 'ACTIVE') return <Badge variant="ok">{status}</Badge>;
  if (status === 'SUSPENDED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
