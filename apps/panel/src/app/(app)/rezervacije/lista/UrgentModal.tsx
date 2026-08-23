'use client';

import Icon from '@/components/Icon';

// Dopuna (23.8.2026, na zahtev vlasnika: "kada se klikne na zvono da se otvori modul u kom
// pise sta je to sto treba sto pre uraditi") — MOCK sadržaj (`urgent.reason` u mock-data.ts);
// pravi izvor bi kasnije bio ista M1 AuditLogEntry/HealthSignal logika koja već postoji za
// M18 operativna upozorenja, ne nov mehanizam.
export default function UrgentModal({ bookingNumber, reason, onClose }: { bookingNumber: string; reason: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-danger bg-panel shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-danger-bg px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-danger">
            <Icon name="bell" />
            Hitno — {bookingNumber}
          </div>
          <button onClick={onClose} title="Zatvori" className="text-danger hover:opacity-70">
            <Icon name="close" />
          </button>
        </div>
        <div className="px-4 py-3 text-xs text-ink-dim">{reason}</div>
      </div>
    </div>
  );
}
