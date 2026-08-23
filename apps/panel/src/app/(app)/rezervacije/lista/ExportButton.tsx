'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import type { MockBookingRow } from './mock-data';

// Dopuna (23.8.2026, na zahtev vlasnika: "Omoguciti export liste rezervacija u excel ili gogle
// drive") — izvozi TRENUTNO FILTRIRANE redove (ono što je vlasnik stvarno video na ekranu, ne
// uvek celu listu). Google Drive dugme namerno ONEMOGUĆENO — objašnjenje u title-u, čeka novu
// tech-stack odluku (OAuth/Drive API), ne prećutan propust.
export default function ExportButton({ rows }: { rows: MockBookingRow[] }) {
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const flatRows = rows.map((b) => ({
        Broj: b.bookingNumber,
        Kreirano: b.createdAt,
        Nosilac: b.buyerName,
        Država: b.country,
        Destinacija: b.destinationCity,
        Hotel: b.hotelName,
        'Tip smeštaja': b.accommodationType,
        Kanal: b.channel,
        Status: b.status,
        Uplata: b.paymentStatus,
        Dolazak: b.stayFrom,
        Odlazak: b.stayTo,
        'Iznos (ukupno)': b.totalPrice / 100,
        Valuta: b.currency,
        Poslovnica: b.branch,
        Zadužen: b.assignedUser,
        Dobavljač: b.supplierName,
        Partner: b.partnerName ?? '',
      }));
      const res = await fetch('/api/rezervacije/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: flatRows }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rezervacije.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={exportExcel}
        disabled={exporting || rows.length === 0}
        title="Izvezi prikazane rezervacije u Excel"
        className="flex h-[26px] items-center gap-1.5 rounded border border-ink-faint px-2 text-[11px] text-ink-dim hover:border-accent hover:text-accent disabled:opacity-40"
      >
        <Icon name="cloud-download" /> {exporting ? 'Izvozim...' : 'Excel'}
      </button>
      <button
        disabled
        title="Google Drive izvoz čeka podešavanje OAuth pristupa — nova tehnička odluka, nije još urađeno"
        className="flex h-[26px] items-center gap-1.5 rounded border border-ink-faint px-2 text-[11px] text-ink-faint opacity-40"
      >
        <Icon name="cloud" /> Google Drive
      </button>
    </div>
  );
}
