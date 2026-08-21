'use client';

import { useState } from 'react';
import Icon from './Icon';
import { useSelection } from './SelectionContext';
import { useTabs } from './TabsContext';
import { createQuoteFromSelection } from '@/app/(app)/rezervacije/pretraga/actions';

// Dizajn dok. §5b — desni panel, "izdvajanje": sažetak reda kad je centar lista i korisnik
// klikne red bez ulaska u pun zapis, ili "Povezano" traka kad centar prikazuje pun zapis
// (npr. gost → njegove rezervacije/fakture/tiketi). Pojavljuje se prema potrebi (dugme u
// TopBar-u, ili automatski čim M5 selekcija dobije prvu stavku — Shell.tsx). NE nosi AI
// razgovor — chat je od 19.8.2026 trajan deo centralnog panela (AiChatBox.tsx, Shell.tsx),
// ovo je odvojena, ranije definisana svrha.
//
// Prvi stvaran sadržaj (21.8.2026, na zahtev vlasnika): M5 spec §3.0e.3 selekcija stavki iz
// pretrage. "Sažetak reda"/"Povezano" varijante (klik na red liste bez otvaranja zapisa) i
// dalje nemaju izvor — nijedan drugi ekran još ne šalje sadržaj ovamo, placeholder ispod
// ostaje za taj slučaj, iskren o tome, ne lažno prazno stanje.
export default function RightPanel({ onClose }: { onClose: () => void }) {
  const { items, removeItem, clear } = useSelection();
  const { navigateInTab } = useTabs();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = Array.from(new Set(items.map((i) => i.finalPriceCurrency)));
  const totalsByCurrency = currencies.map((c) => ({
    currency: c,
    total: items.filter((i) => i.finalPriceCurrency === c).reduce((sum, i) => sum + i.finalPrice, 0),
  }));

  async function handleCreateQuote() {
    setPending(true);
    setError(null);
    const res = await createQuoteFromSelection(items);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    clear();
    onClose();
    if (res.quoteId) navigateInTab(`/rezervacije/ponude/${res.quoteId}`, 'Ponuda');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-panel-2">
      <div className="flex h-[43px] flex-shrink-0 items-center justify-between border-b border-border px-2 text-xs font-medium text-ink-faint">
        <span>{items.length > 0 ? `Selekcija (${items.length})` : 'Izdvajanje'}</span>
        <button onClick={onClose} title="Zatvori panel" className="flex h-[29px] w-[29px] items-center justify-center rounded hover:bg-panel hover:text-ink">
          <Icon name="close" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-ink-faint">
          <Icon name="inspect" className="text-2xl" />
          <p>Klikni na red liste (bez otvaranja zapisa) da vidiš sažetak ovde, ili otvori pun zapis za "Povezano" prikaz.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex flex-col gap-2">
              {items.map((i) => (
                <SelectionRow key={i.key} item={i} onRemove={() => removeItem(i.key)} />
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-border p-2">
            {currencies.length > 1 && (
              <p className="mb-2 rounded bg-warn-bg px-2 py-1 text-[11px] text-warn">
                Selekcija sadrži više valuta — zbir po valuti ispod, konverzija se rešava pri fakturisanju (M10).
              </p>
            )}
            <div className="mb-2 flex flex-col gap-0.5 text-xs text-ink-dim">
              {totalsByCurrency.map((t) => (
                <div key={t.currency} className="flex items-center justify-between">
                  <span>Zbir ({t.currency})</span>
                  <span className="font-mono font-semibold text-ink">
                    {(t.total / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {t.currency}
                  </span>
                </div>
              ))}
            </div>
            {error && <p className="mb-2 text-[11px] text-danger">{error}</p>}
            <button
              onClick={handleCreateQuote}
              disabled={pending}
              className="w-full rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
            >
              {pending ? '…' : 'Napravi ponudu'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpiryBadge({ quoteExpiresAt }: { quoteExpiresAt: string }) {
  const minutesLeft = Math.round((new Date(quoteExpiresAt).getTime() - Date.now()) / 60000);
  const expired = minutesLeft <= 0;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${expired ? 'bg-danger-bg text-danger' : 'bg-warn-bg text-warn'}`}>
      {expired ? 'istekla' : `ističe za ${minutesLeft} min`}
    </span>
  );
}

function SelectionRow({ item, onRemove }: { item: import('./SelectionContext').SelectionItem; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-2 text-xs">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{item.productName}</div>
          <div className="text-[11px] text-ink-faint">{item.productType}</div>
        </div>
        <button onClick={onRemove} title="Ukloni iz selekcije" className="flex-shrink-0 text-ink-faint hover:text-danger">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-semibold text-ink">
          {(item.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {item.finalPriceCurrency}
        </span>
        {item.sourceType === 'API' && item.quoteExpiresAt && <ExpiryBadge quoteExpiresAt={item.quoteExpiresAt} />}
      </div>
    </div>
  );
}
