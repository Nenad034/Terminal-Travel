'use client';

import Icon from './Icon';

// Dizajn dok. §5b — desni panel, "izdvajanje": sažetak reda kad je centar lista i korisnik
// klikne red bez ulaska u pun zapis, ili "Povezano" traka kad centar prikazuje pun zapis
// (npr. gost → njegove rezervacije/fakture/tiketi). Pojavljuje se prema potrebi (dugme u
// TopBar-u), NE nosi AI razgovor — chat je od 19.8.2026 trajan deo centralnog panela
// (AiChatBox.tsx, Shell.tsx), ovo je odvojena, ranije definisana svrha. Nijedan ekran još
// ne šalje sadržaj ovamo (nijedna lista još nema "klik na red bez otvaranja zapisa" ni "pun
// zapis" u ovom prolazu) — placeholder ispod je iskren o tome, ne lažno prazno stanje.
export default function RightPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col bg-panel-2">
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-border px-2 text-xs font-medium text-ink-faint">
        <span>Izdvajanje</span>
        <button onClick={onClose} title="Zatvori panel" className="flex h-6 w-6 items-center justify-center rounded hover:bg-panel hover:text-ink">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-ink-faint">
        <Icon name="inspect" className="text-2xl" />
        <p>Klikni na red liste (bez otvaranja zapisa) da vidiš sažetak ovde, ili otvori pun zapis za "Povezano" prikaz.</p>
      </div>
    </div>
  );
}
