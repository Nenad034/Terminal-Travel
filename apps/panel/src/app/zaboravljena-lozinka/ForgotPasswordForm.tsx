'use client';

import { useState } from 'react';
import Link from 'next/link';

// M1 spec §5 (dopuna 4.9.2026) — traženje linka za promenu lozinke. Odgovor je NAMERNO uvek
// isti, bez obzira da li nalog sa tom adresom postoji: različita poruka bi dozvolila da se
// pogađanjem adresa utvrdi ko ima nalog u sistemu (ista logika kao poruka „Pogrešan email ili
// lozinka" pri prijavi). Zato ovaj ekran nikad ne kaže „nalog ne postoji".
export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/session/password-forgot', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email') }),
      headers: { 'Content-Type': 'application/json' },
    });
    setPending(false);

    if (!res.ok) {
      setError('Zahtev nije prošao. Pokušajte ponovo za koji trenutak.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-mono text-lg">&gt; proverite --postu</h1>
        <p className="rounded bg-ok-bg p-3 text-sm text-ok">
          Ako nalog sa tom adresom postoji, poslali smo poruku sa linkom za promenu lozinke. Link važi
          jedan sat.
        </p>
        <Link href="/prijava" className="text-xs text-ink-faint hover:text-ink">
          ← nazad na prijavu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h1 className="font-mono text-lg">&gt; zaboravljena --lozinka</h1>
      <p className="text-xs text-ink-dim">
        Unesite email vašeg naloga — poslaćemo vam link za postavljanje nove lozinke.
      </p>
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <label className="text-xs text-ink-faint">
        email
        <input
          type="email"
          name="email"
          required
          autoFocus
          className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded bg-accent px-4 py-2 font-mono font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? 'šaljem…' : './posalji_link'}
      </button>
      <Link href="/prijava" className="text-xs text-ink-faint hover:text-ink">
        ← nazad na prijavu
      </Link>
    </form>
  );
}
