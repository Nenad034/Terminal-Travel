'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useTabs } from './TabsContext';

interface ProductContactDetail {
  id: string;
  name: string | null;
  contact: { phone?: string; email?: string; address?: string } | null;
}

// M17 spec "Desni panel — brzi pregled proizvoda" (26.8.2026, Faza B) — kad je pun opis
// proizvoda otvoren u centralnom panelu (`/katalog/[id]/pregled`), desni panel prikazuje
// kontakt hotela (`attributes.contact`, M2 spec §2.3 dopuna) i link ka aktivnim rezervacijama
// za taj proizvod (M5 `GET /sales/bookings?productId=...`, isti obrazac kao ostali BFF filteri
// trake u `rezervacije/lista`). Reuse iste `/api/catalog/products/:id/preview` BFF rute kao
// `ProductPreviewCard` (isti trimovan oblik).
export default function ProductContactCard({ productId }: { productId: string }) {
  const { openTab } = useTabs();
  const [detail, setDetail] = useState<ProductContactDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(false);
    fetch(`/api/catalog/products/${productId}/preview`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: ProductContactDetail) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {!detail && !error && <p className="p-2 text-xs text-ink-faint">Učitavanje…</p>}
      {error && <p className="p-2 text-xs text-danger">Proizvod nije moguće učitati.</p>}

      {detail && (
        <>
          <div className="mb-3 font-medium text-ink">{detail.name}</div>

          <div className="mb-3 rounded-lg border border-border bg-panel p-2 text-xs">
            <div className="mb-1.5 font-medium text-ink-faint">Kontakt</div>
            {detail.contact?.phone || detail.contact?.email || detail.contact?.address ? (
              <div className="flex flex-col gap-0.5 text-ink-dim">
                {detail.contact.phone && <div>{detail.contact.phone}</div>}
                {detail.contact.email && <div>{detail.contact.email}</div>}
                {detail.contact.address && <div>{detail.contact.address}</div>}
              </div>
            ) : (
              <p className="text-ink-faint">Kontakt nije unet za ovaj proizvod.</p>
            )}
          </div>

          <button
            onClick={() => {
              // "Aktivne" = nije CANCELLED/COMPLETED (M5 spec BookingStatus) — isti multiselect
              // obrazac kao RealFilterBar (ponovljen `status=` parametar).
              const params = new URLSearchParams();
              params.set('productId', detail.id);
              for (const s of ['PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED']) params.append('status', s);
              openTab(`/rezervacije/lista?${params.toString()}`, `Rezervacije — ${detail.name ?? ''}`);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-accent px-2 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent-soft"
          >
            <Icon name="calendar" /> Aktivne rezervacije
          </button>
        </>
      )}
    </div>
  );
}
