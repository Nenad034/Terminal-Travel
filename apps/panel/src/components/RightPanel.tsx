'use client';

import Icon from './Icon';
import AiChatBox from './AiChatBox';

// Dizajn dok. §5d ("dugme za podelu ekrana") i §6c (chat fiksiran pri dnu desnog panela).
// Prvi prolaz: samo AI razgovor kao sadržaj. Sažetak zapisa/"Povezano" traka (§5b) čekaju
// ekran koji bi ih stvarno popunio — namerno van obima, upisano u M17 spec.
export default function RightPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col bg-panel-2">
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-border px-2 text-xs font-medium text-ink-faint">
        <span>AI razgovor</span>
        <button onClick={onClose} title="Zatvori panel" className="flex h-6 w-6 items-center justify-center rounded hover:bg-panel hover:text-ink">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <AiChatBox variant="panel" />
      </div>
    </div>
  );
}
