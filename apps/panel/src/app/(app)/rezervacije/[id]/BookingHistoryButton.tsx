'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import BookingTimelineModal from '@/components/BookingTimelineModal';

// Dopuna (23.8.2026, na zahtev vlasnika) — klijentski "ostrvo" unutar server-renderovane
// stranice detalja rezervacije, isti obrazac kao `PrepareFiscalDocumentButton.tsx`.
export default function BookingHistoryButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Tok rezervacije — ceo workflow, ko je i kada radio promenu"
        className="flex h-[26px] w-[26px] items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-ink"
      >
        <Icon name="three-bars" />
      </button>
      {open && <BookingTimelineModal bookingId={bookingId} onClose={() => setOpen(false)} />}
    </>
  );
}
