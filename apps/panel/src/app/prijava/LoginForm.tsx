'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// M1 spec §5, M17 spec §3 — prijava je uvek dvokoračna za interne uloge (obavezna 2FA).
// Korak 1: email+lozinka -> /api/session/login. Ako nalog ima MFA (uvek za STAFF), server
// vraća {requiresMfa, mfaToken} umesto tokena; korak 2 šalje 6-cifreni kod ka
// /api/session/mfa, koji jedini upisuje sesijski kolačić.
export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/session/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(body?.message ?? 'Prijava nije uspela.');
      return;
    }
    if (body.requiresMfa) {
      setMfaToken(body.mfaToken);
      setStep('mfa');
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function onMfaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/session/mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code: form.get('code') }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(body?.message ?? 'Neispravan MFA kod.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (step === 'mfa') {
    return (
      <form onSubmit={onMfaSubmit} className="flex flex-col gap-3">
        <h1 className="font-mono text-lg">&gt; 2fa --verify</h1>
        <p className="text-xs text-ink-dim">6-cifreni kod iz autentifikator aplikacije. Obavezno za interne uloge.</p>
        {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
        <input
          name="code"
          required
          maxLength={6}
          autoFocus
          placeholder="000000"
          className="w-full rounded border border-border bg-bg px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 font-mono font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
        >
          ./potvrdi
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onCredentialsSubmit} className="flex flex-col gap-3">
      <h1 className="font-mono text-lg">&gt; prijava --panel</h1>
      <p className="text-xs text-ink-dim">Interni tim agencije. Unesite email i lozinku vašeg naloga.</p>
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
      <label className="text-xs text-ink-faint">
        lozinka
        <input
          type="password"
          name="password"
          required
          className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded bg-accent px-4 py-2 font-mono font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
      >
        ./prijavi_se
      </button>
    </form>
  );
}
