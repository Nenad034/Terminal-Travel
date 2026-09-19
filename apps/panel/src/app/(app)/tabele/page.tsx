import RegisterTab from '@/components/RegisterTab';
import { apiFetch } from '@/lib/api-client';
import { getMe } from '@/lib/me';
import TabeleScreen, { type SavedTableEntry, type TableSourceInfo } from './TabeleScreen';

// M17 spec §6e.2 — „Tabele": sačuvane tabele (UserPreference `tt.tables`) + „Nova tabela"
// bez AI-ja (izbor izvora i filtera iz istog registra koji koristi `open_table`).
export default async function TabelePage() {
  const me = await getMe();
  let saved: SavedTableEntry[] = [];
  let sources: TableSourceInfo[] = [];
  try {
    const prefs = await apiFetch<Record<string, unknown>>('/iam/users/me/preferences');
    saved = Array.isArray(prefs?.['tt.tables']) ? (prefs['tt.tables'] as SavedTableEntry[]) : [];
  } catch {
    saved = [];
  }
  try {
    sources = await apiFetch<TableSourceInfo[]>('/ai-orchestration/tables/sources');
  } catch {
    sources = [];
  }
  return (
    <div className="p-4">
      <RegisterTab label="Tabele" />
      <TabeleScreen saved={saved} sources={sources} userName={me?.fullName ?? ''} />
    </div>
  );
}
