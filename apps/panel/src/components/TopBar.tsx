'use client';

import { useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5 — "gornja traka minimalna, jedna tanka linija —
// bez gomile vidljivih dugmića; sve teško ide kroz komandnu paletu".
export default function TopBar({ fullName, roles }: { fullName: string; roles: string[] }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.push('/prijava');
    router.refresh();
  }

  return (
    <header className="flex h-9 flex-shrink-0 items-center gap-3 border-b border-border bg-panel-2 px-3 text-xs">
      <span className="font-mono font-bold tracking-wide text-accent">TERMINAL</span>
      <div className="flex-1" />
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        className="flex items-center gap-2 rounded border border-border bg-panel px-2 py-1 font-mono text-ink-faint hover:border-accent"
      >
        <Icon name="search" />
        traži ili izvrši
        <kbd className="rounded border border-border bg-panel-2 px-1 text-[10px]">Ctrl K</kbd>
      </button>
      <span className="text-ink-dim">
        {fullName} <span className="text-ink-faint">· {roles.join(', ')}</span>
      </span>
      <ThemeToggle />
      <button
        onClick={logout}
        title="Odjava"
        className="flex h-7 w-7 items-center justify-center rounded border border-border bg-panel text-ink-faint hover:border-danger hover:text-danger"
      >
        <Icon name="sign-out" />
      </button>
    </header>
  );
}
