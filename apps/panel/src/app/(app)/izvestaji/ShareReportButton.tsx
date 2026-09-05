'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';

interface Conversation {
  id: string;
  name: string | null;
  type: string;
}

type TableFormat = 'EXCEL' | 'PDF' | 'HTML';

// M13 spec §7 v1.5 — dugme "Podeli izveštaj" (5.9.2026, vlasnikov zahtev: "omogucite slanje
// izvestaja putem mejla, ili putem poruka... i infografik i tekstualno"). Dva kanala, dva oblika:
//   - Interni chat — TABELA (Excel/PDF/HTML, isti fajl-prilog mehanizam kao M15 §6.9.3, sad
//     deljen preko `apps/api/src/common/reports/`) ILI INFOGRAFIK (PNG snimak trenutno prikazanog
//     sadržaja preko `html2canvas`, klijentski — nema server-side headless browser-a).
//   - Mejl — NAMERNO `mailto:` link (potvrđeno preko `AskUserQuestion`), ne pravo slanje sa
//     servera (to je već zavedena, blokirana stavka — M22 "Compose", `docs/analize/27-...md`).
//     `mailto:` nema prilog, pa nosi SAMO tekstualnu tabelu (poravnata monospejs kolone), nikad
//     infografik.
export default function ShareReportButton({
  reportKind,
  title,
  rows,
  captureElementId,
}: {
  reportKind: 'profitability' | 'sales' | 'occupancy' | 'dynamic' | 'marketing';
  title: string;
  // `object[]` umesto `Record<string, unknown>[]` NAMERNO — pozivaoci prosleđuju konkretne
  // interfejse (`Bucket[]` i sl.) koji imaju poznata polja ali nemaju eksplicitan indeksni
  // potpis, pa se strukturno ne bi poklopili sa `Record<string, unknown>` bez `as` na svakom
  // pozivnom mestu. Ovde je oblik svejedno nebitan — koristi se isključivo `Object.keys`/JSON
  // serijalizacija ka backend-u, nikad tipizovan pristup pojedinačnom polju.
  rows: object[];
  /** `id` DOM elementa koji se snima za infografik (html2canvas) — sadržaj TRENUTNO prikazanog
   * dela ekrana (tabela ili grafik, šta god je aktivan `view`), ne fiksna slika. */
  captureElementId: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<TableFormat>('EXCEL');
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function togglePicker() {
    const next = !open;
    setOpen(next);
    setError(null);
    if (next && conversations === null) {
      try {
        const res = await fetch('/api/chat/conversations');
        setConversations(res.ok ? await res.json() : []);
      } catch {
        setConversations([]);
      }
    }
  }

  async function exportAndSend(conversation: Conversation, body: Record<string, unknown>) {
    setSending(conversation.id);
    setError(null);
    setSentTo(null);
    try {
      const exportRes = await fetch('/api/bi/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!exportRes.ok) throw new Error();
      const { id } = await exportRes.json();
      const sendRes = await fetch(`/api/bi/reports/export/${id}/send-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.id }),
      });
      if (!sendRes.ok) throw new Error();
      setSentTo(conversation.name ?? conversation.type);
    } catch {
      setError('Slanje nije uspelo — pokušaj ponovo.');
    } finally {
      setSending(null);
    }
  }

  function sendTable(conversation: Conversation) {
    return exportAndSend(conversation, { reportKind, title, format, rows });
  }

  // "Izvoz" — direktno preuzimanje na računar, bez slanja u chat (5.9.2026, vlasnikov zahtev:
  // "kada se klkne na podeli dodati i opciju export pa stavite ikone za excel i google sheet").
  // Obe ikonice preuzimaju ISTI Excel (.xlsx) fajl preko postojećeg export/download mehanizma
  // (isti kao `rezervacije/lista/ExportButton.tsx`) — nema stvarne Google Sheets integracije
  // (to bi tražilo Google OAuth, nov eksterni servis van tehničkog steka, potvrđeno preko
  // `AskUserQuestion` da NIJE obim ovog zahteva); Google Sheets otvara .xlsx bez problema, pa je
  // ikonica ovde čisto vizuelni pokazatelj namene, ne poseban format ni poseban poziv.
  async function exportAndDownload() {
    setSending('export');
    setError(null);
    setSentTo(null);
    try {
      const exportRes = await fetch('/api/bi/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportKind, title, format: 'EXCEL', rows }),
      });
      if (!exportRes.ok) throw new Error();
      const { id } = await exportRes.json();
      const downloadRes = await fetch(`/api/bi/reports/export/${id}/download`);
      if (!downloadRes.ok) throw new Error();
      const blob = await downloadRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Izvoz nije uspeo — pokušaj ponovo.');
    } finally {
      setSending(null);
    }
  }

  async function sendInfographic(conversation: Conversation) {
    setSending(conversation.id);
    setError(null);
    setSentTo(null);
    try {
      const el = document.getElementById(captureElementId);
      if (!el) throw new Error();
      // Dinamički import — `html2canvas` je čisto klijentska biblioteka (čita DOM/canvas),
      // nema razloga da uđe u server-render bundle ove (server) stranice.
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff' });
      await exportAndSend(conversation, { reportKind, title, format: 'PNG', imageBase64: canvas.toDataURL('image/png') });
    } catch {
      setError('Slanje nije uspelo — pokušaj ponovo.');
      setSending(null);
    }
  }

  // Mejl — čist tekst, poravnate kolone (monospejs) kao najbliža aproksimacija tabele koju
  // `mailto:` telo (plain text) uopšte može da nosi. Ograničeno na prvih 100 redova — `mailto:`
  // linkovi imaju praktično ograničenje dužine (browser/OS zavisno, ali reda veličine par hiljada
  // znakova pouzdano radi svuda), veći izveštaj bi tiho otkinuo URL.
  function mailtoHref(): string {
    const dicts = rows as Record<string, unknown>[];
    const cols = dicts.length > 0 ? Object.keys(dicts[0]) : [];
    const widths = cols.map((c) => Math.max(c.length, ...dicts.map((r) => String(r[c] ?? '').length)) + 2);
    const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join('');
    const header = cols.length > 0 ? `${line(cols)}\n${line(cols.map((_, i) => '-'.repeat(Math.max(0, widths[i] - 2))))}\n` : '';
    const shown = dicts.slice(0, 100);
    const body = shown.map((r) => line(cols.map((c) => String(r[c] ?? '')))).join('\n');
    const truncated = rows.length > shown.length ? `\n… i još ${rows.length - shown.length} redova (pun izveštaj preuzmi iz panela).` : '';
    const text = rows.length === 0 ? 'Nema podataka za zadate filtere.' : `${header}${body}${truncated}`;
    return `mailto:?subject=${encodeURIComponent(`Izveštaj — ${title}`)}&body=${encodeURIComponent(text)}`;
  }

  return (
    <div className="relative">
      <button
        onClick={togglePicker}
        className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium ${
          open ? 'border-accent text-accent' : 'border-border text-ink-dim hover:border-accent hover:text-accent'
        }`}
      >
        <Icon name="share" /> Podeli
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-lg border border-border bg-panel p-2.5 text-xs shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex-shrink-0 text-ink-faint">format tabele</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as TableFormat)} className="input flex-1 text-[11px]">
              <option value="EXCEL">Excel</option>
              <option value="PDF">PDF</option>
              <option value="HTML">HTML</option>
            </select>
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Izvoz</div>
          <div className="mb-2 flex gap-1.5">
            <button
              disabled={sending === 'export'}
              onClick={exportAndDownload}
              title="Preuzmi kao Excel (.xlsx)"
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-ink-faint px-2 py-1.5 text-accent hover:border-accent disabled:opacity-40"
            >
              <Icon name="cloud-download" /> Excel
            </button>
            <button
              disabled={sending === 'export'}
              onClick={exportAndDownload}
              title="Preuzmi kao fajl pogodan za Google Sheets (.xlsx)"
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-ink-faint px-2 py-1.5 text-accent hover:border-accent disabled:opacity-40"
            >
              <Icon name="globe" /> Google Sheet
            </button>
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Interni chat</div>
          <div className="mb-2 max-h-36 overflow-y-auto rounded border border-border">
            {conversations === null ? (
              <div className="px-2 py-1.5 text-ink-faint">učitavam…</div>
            ) : conversations.length === 0 ? (
              <div className="px-2 py-1.5 text-ink-faint">Nema dostupnih razgovora.</div>
            ) : (
              conversations.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-1 border-b border-border px-2 py-1 last:border-b-0">
                  <span className="truncate text-ink-dim">{c.name ?? c.type}</span>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      disabled={sending === c.id}
                      onClick={() => sendTable(c)}
                      title="Pošalji tabelu"
                      className="rounded border border-ink-faint px-1.5 py-0.5 text-accent hover:border-accent disabled:opacity-40"
                    >
                      tabela
                    </button>
                    <button
                      disabled={sending === c.id}
                      onClick={() => sendInfographic(c)}
                      title="Pošalji sliku (infografik)"
                      className="rounded border border-ink-faint px-1.5 py-0.5 text-accent hover:border-accent disabled:opacity-40"
                    >
                      slika
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Mejl</div>
          <a
            href={mailtoHref()}
            className="flex items-center justify-center gap-1.5 rounded border border-ink-faint px-2 py-1.5 text-accent hover:border-accent"
          >
            <Icon name="mail" /> Pošalji mejlom (tekst)
          </a>

          {sentTo && (
            <p className="mt-2 flex items-center gap-1 text-ok">
              <Icon name="check" /> Poslato u &quot;{sentTo}&quot;.
            </p>
          )}
          {error && <p className="mt-2 text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
