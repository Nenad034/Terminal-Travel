'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import BookingTimelineModal, { type TimelineEntry } from '@/components/BookingTimelineModal';

export default function FullRecordTimelineButton({ entries }: { entries: TimelineEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Tok rezervacije — ceo workflow, ko je i kada radio promenu"
        className="flex h-[28px] items-center gap-1.5 rounded border border-ink-faint px-2 text-xs text-ink-faint hover:border-accent hover:text-accent"
      >
        <Icon name="three-bars" /> Tok rezervacije
      </button>
      {open && <BookingTimelineModal mockEntries={entries} onClose={() => setOpen(false)} />}
    </>
  );
}
