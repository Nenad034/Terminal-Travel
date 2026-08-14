// docs/analize/29-DIZAJN-SISTEM-UI.md §3a — Codicons (@vscode/codicons), jednobojne,
// prate boju teksta (currentColor preko CSS-a, ne sopstvena paleta).
export default function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`codicon codicon-${name} ${className}`} aria-hidden="true" />;
}
