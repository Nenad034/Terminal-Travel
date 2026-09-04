'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// M1 spec §5/§7 (dopuna 4.9.2026) — stranica na kojoj POZVANI kolega postavlja svoju prvu
// lozinku. Do sada nije postojala: `POST /iam/users` je pravio nalog u statusu INVITED i
// vraćao token, ali nijedan ekran taj token nije trošio, pa nalog nikad nije mogao da
// postane upotrebljiv. Stranica je namerno van `(app)` grupe — pozvani još nema sesiju.
export default function ActivationForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');

    // Ista pravila kao backend (min 12 karaktera) — ovo je samo UI ograda da se čovek ne
    // šalje na server zbog greške koju forma može odmah da kaže, ne jedini oslonac.
    if (password.length < 12) {
      setError('Lozinka mora imati najmanje 12 karaktera.');
      return;
    }
    if (password !== String(form.get('passwordRepeat') ?? '')) {
      setError('Lozinke se ne poklapaju.');
      return;
    }

    setPending(true);
    const res = await fetch('/api/session/activate', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword: password }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(body?.message ?? 'Aktivacija nije uspela.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-mono text-lg">&gt; nalog --aktiviran</h1>
        <p className="rounded bg-ok-bg p-3 text-sm text-ok">
          Lozinka je postavljena. Prijavite se — pri prvoj prijavi ćete podesiti dvofaktorsku zaštitu
          (obavezna je za sve interne naloge).
        </p>
        <button
          onClick={() => router.push('/prijava')}
          className="rounded bg-accent px-4 py-2 font-mono font-semibold text-accent-ink hover:bg-accent-strong"
        >
          ./na_prijavu
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h1 className="font-mono text-lg">&gt; aktivacija --naloga</h1>
      <p className="text-xs text-ink-dim">
        Postavite lozinku za svoj nalog. Najmanje 12 karaktera.
      </p>
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <label className="text-xs text-ink-faint">
        nova lozinka
        <input
          type="password"
          name="password"
          required
          minLength={12}
          autoFocus
          className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-xs text-ink-faint">
        ponovite lozinku
        <input
          type="password"
          name="passwordRepeat"
          required
          minLength={12}
          className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded bg-accent px-4 py-2 font-mono font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? 'čuvam…' : './postavi_lozinku'}
      </button>
    </form>
  );
}
