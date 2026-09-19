import RegisterTab from '@/components/RegisterTab';
import { getMe, hasPermission } from '@/lib/me';
import { decodeTableSpec } from '@/lib/table-spec';
import TerminalTable from './TerminalTable';

// M17 spec §6e.2 — tab Terminal tabele: spec u adresi (base64url), podaci se svaki put vuku
// iznova. Scenario (§6e.4) samo uz `M13/scenario/USE` — bez nje panel parametara ne postoji.
export default async function TabelaPrikazPage(props: {
  searchParams: Promise<{ spec?: string }>;
}) {
  const { spec: encoded } = await props.searchParams;
  const me = await getMe();
  const decoded = decodeTableSpec(encoded);
  const canScenario = hasPermission(me, 'M13', 'scenario', 'USE');

  if (!decoded) {
    return (
      <div className="p-4">
        <RegisterTab label="Tabela" />
        <p className="rounded border border-danger bg-danger-bg px-3 py-2 text-xs text-danger">
          Adresa tabele nije čitljiva. Otvorite tabelu ponovo iz AI razgovora ili sa spiska
          &bdquo;Tabele&ldquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <TerminalTable
        spec={decoded.spec}
        initialSettings={decoded.settings}
        canScenario={canScenario}
      />
    </div>
  );
}
