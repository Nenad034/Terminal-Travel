import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  _count: { userRoles: number };
}

// M1 spec §7 — GET /iam/roles. Uloge dodate kasnijim fazama (SUBAGENT_ADMIN iz M7, VODIC iz
// M9) su već aktivne u bazi (te faze su implementirane) — spec §7 "zaključano" se odnosilo na
// stanje PRE nego što je ta faza stigla; danas nema uloge koju treba prikazati zaključanu.
export default async function UlogePage() {
  const me = await getMe();
  const canView = hasPermission(me, 'M1', 'role', 'VIEW');

  let roles: RoleRow[] = [];
  let error: string | null = null;
  if (!canView) {
    error = 'Nemate dozvolu za uvid u uloge (M1/role/VIEW).';
  } else {
    try {
      roles = await apiFetch<RoleRow[]>('/iam/roles');
    } catch {
      error = 'Učitavanje uloga nije uspelo.';
    }
  }

  return (
    <div className="p-6">
      <RegisterTab label="Uloge" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> korisnici/uloge/
          </h1>
          <p className="text-xs text-ink-dim">Sistemske uloge i broj nosilaca — M1 spec poglavlje 4.</p>
        </div>
        <Link href="/korisnici" className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink">
          <Icon name="arrow-left" /> nazad na korisnike
        </Link>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle>{r.name}</CardTitle>
                {r.isSystemRole && (
                  <Badge variant="secondary" className="text-ink-faint">
                    sistemska
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <p className="text-xs text-ink-dim">{r.description}</p>
                <p className="mt-2 text-[11px] text-ink-faint">
                  {r._count.userRoles} {r._count.userRoles === 1 ? 'nosilac' : 'nosilaca'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
