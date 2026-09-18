import Icon from './Icon';

// M15 spec §6.5.4.8/§6.5.4.9 (18.9.2026, vlasnikov zahtev: "u gornju traku modula ai agenta
// stavite ikonice u mejl, excel, pdf i html") — čisto informativan podsetnik uz naslov "AI
// asistent" (isto mesto kao `sparkle` ikonica) da agent ume da PREDLOŽI mejl (compose_email,
// predlog-pa-odobrenje) i da napravi Excel/PDF/HTML fajl (generate_report) iz razgovora — obe
// sposobnosti se pozivaju običnim pitanjem u chat-u, ne klikom na ove ikonice (nisu dugmad,
// nemaju onClick — isti "informativan podsetnik" princip kao svaka druga statična ikonica u
// trakama ovog panela, npr. --icon-line boja ikonica u globals.css).
// `file-pdf` postoji doslovno u Codicon setu; `table`/`file-code` su najbliži zamenici za
// Excel/HTML (Codicon nema poseban glif za svaki format fajla, isti kompromis kao `euro` u
// Icon.tsx za valutu).
const CAPABILITIES: { name: string; title: string }[] = [
  { name: 'mail', title: 'Ume da predloži mejl (nacrt, čeka tvoje odobrenje pre slanja)' },
  { name: 'table', title: 'Ume da napravi Excel fajl od podataka iz razgovora' },
  { name: 'file-pdf', title: 'Ume da napravi PDF fajl od podataka iz razgovora' },
  { name: 'file-code', title: 'Ume da napravi HTML fajl od podataka iz razgovora' },
];

export default function AiCapabilityIcons() {
  return (
    <span className="flex items-center gap-1 text-ink-faint">
      {CAPABILITIES.map((c) => (
        <span key={c.name} title={c.title}>
          <Icon name={c.name} className="!text-[13px]" />
        </span>
      ))}
    </span>
  );
}
