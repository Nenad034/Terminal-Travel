// Jedinstveno obeležavanje autora radnje — čovek / AI agent / spoljni nalog.
//
// Izvor pravila: docs/analize/29-DIZAJN-SISTEM-UI.md §6a; obaveza panela: M17 spec §3.1.
// Ovo je NAMERNO jedna deljena komponenta, ne obrazac koji svaki ekran prepisuje (§6a pravilo 5) —
// pre nje je svaki ekran imao sopstvenu varijantu ("AI nacrt" bedž u M14, svoj obrazac u M6/M12,
// sirov enum u audit logu), što je tačno onaj rasap koji CLAUDE.md navodi kao pouku iz PrimeTravel-a.
//
// Pravila koja komponenta sprovodi, da ih pozivalac ne mora pamtiti:
//  1. oznaka je uvek vidljiva (nikad tooltip/hover),
//  2. AI nacrt koji je čovek poslao prikazuje OBA podatka, nikad samo jedno,
//  3. sirova tehnička vrednost se nikad ne ispisuje,
//  4. akcentna boja je rezervisana isključivo za AI — spoljni nalozi dobijaju neutralnu oznaku.

// Prihvata oba rečnika koja baza koristi: AccountType (M1 User) i ActorType (AuditLogEntry).
export type ActorOrigin =
  | 'STAFF'
  | 'HUMAN'
  | 'AI_AGENT'
  | 'SUPPLIER_CONTACT'
  | 'SUBAGENT_CONTACT'
  | 'GUEST'
  | 'SYSTEM'
  | (string & {});

type BadgeKind = 'none' | 'ai' | 'neutral';

interface OriginPresentation {
  kind: BadgeKind;
  badge?: string;
}

function presentationFor(origin: ActorOrigin): OriginPresentation {
  switch (origin) {
    // Zaposleni je podrazumevano stanje — bez dodatne oznake (§6a.1).
    case 'STAFF':
    case 'HUMAN':
      return { kind: 'none' };
    case 'AI_AGENT':
      return { kind: 'ai', badge: 'AI' };
    case 'SUPPLIER_CONTACT':
      return { kind: 'neutral', badge: 'dobavljač' };
    case 'SUBAGENT_CONTACT':
      return { kind: 'neutral', badge: 'subagent' };
    case 'GUEST':
      return { kind: 'neutral', badge: 'gost' };
    case 'SYSTEM':
      return { kind: 'neutral', badge: 'sistem' };
    // §6a.2 pravilo 3 — nepoznata vrednost se ne propušta sirova u interfejs.
    default:
      return { kind: 'neutral', badge: 'nepoznato poreklo' };
  }
}

export function Badge({ kind, children }: { kind: Exclude<BadgeKind, 'none'>; children: React.ReactNode }) {
  const className =
    kind === 'ai'
      ? 'rounded bg-accent-soft px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-accent'
      : 'rounded bg-panel2 px-1 py-px text-[10px] text-ink-faint';
  return <span className={className}>{children}</span>;
}

export default function ActorLabel({
  name,
  origin,
  org,
  draftedByAi = false,
  draftedByName = 'AI agent',
  className = '',
}: {
  /** Ime osobe ili agenta. Prazno/nepoznato se prikazuje kao "nepoznat korisnik", ne kao ID. */
  name?: string | null;
  origin: ActorOrigin;
  /** Naziv firme/uloge uz spoljni nalog (§6a.1) — npr. naziv dobavljača ili subagentske agencije. */
  org?: string | null;
  /** Tekst potiče iz AI nacrta koji je ovaj čovek pregledao i poslao (M19 §2.3, M14 AI_DRAFT). */
  draftedByAi?: boolean;
  /** Ime agenta koji je napisao nacrt, ako je poznato. */
  draftedByName?: string | null;
  className?: string;
}) {
  const { kind, badge } = presentationFor(origin);

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <span className="font-semibold">{name?.trim() || 'nepoznat korisnik'}</span>
      {org && <span className="text-ink-faint">({org})</span>}
      {kind !== 'none' && badge && <Badge kind={kind}>{badge}</Badge>}
      {/* §6a.2 pravilo 2 — poreklo teksta ne poništava se time što ga je čovek poslao. */}
      {draftedByAi && origin !== 'AI_AGENT' && (
        <span className="inline-flex items-center gap-1 text-ink-faint">
          · nacrt: {draftedByName?.trim() || 'AI agent'}
          <Badge kind="ai">AI</Badge>
        </span>
      )}
    </span>
  );
}
