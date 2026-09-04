'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// M1 spec §5, M17 spec §3 — prijava je za interne uloge uvek višekoračna (obavezna 2FA).
// Korak 1: email+lozinka -> /api/session/login. Ako nalog ima MFA (uvek za STAFF), server
// vraća {requiresMfa, mfaToken} umesto tokena; korak 2 šalje 6-cifreni kod ka
// /api/session/mfa, koji jedini upisuje sesijski kolačić.
export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'mfa' | 'mfa-setup'>('credentials');
  const [mfaToken, setMfaToken] = useState('');
  // M1 spec §5/§7 (dopuna 4.9.2026) — prvo podešavanje 2FA. Nalog koji 2FA mora imati a
  // još je nema više ne dobija grešku nego uzak setupToken; ovaj korak je jedini deo panela
  // koji se tim tokenom otvara.
  const [setupToken, setSetupToken] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
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
    if (body.requiresMfaSetup) {
      setSetupToken(body.setupToken);
      setStep('mfa-setup');
      void startMfaSetup(body.setupToken);
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

  async function startMfaSetup(token: string) {
    setPending(true);
    const res = await fetch('/api/session/mfa-setup', {
      method: 'POST',
      body: JSON.stringify({ action: 'start', setupToken: token }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(body?.message ?? 'Podešavanje 2FA nije uspelo.');
      return;
    }
    setOtpauthUrl(body.otpauthUrl);
    setQrDataUrl(body.qrDataUrl ?? '');
    setRecoveryCodes(body.recoveryCodes ?? []);
  }

  async function onMfaSetupSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/session/mfa-setup', {
      method: 'POST',
      body: JSON.stringify({ action: 'confirm', setupToken, code: form.get('code') }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(body?.message ?? 'Neispravan kod.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  // Tajna se čita iz otpauth URL-a — ista vrednost koju nosi QR kod, za ručan unos u
  // aplikaciju kad skeniranje nije moguće (npr. autentifikator na istom računaru).
  const manualSecret = otpauthUrl ? new URLSearchParams(otpauthUrl.split('?')[1] ?? '').get('secret') : null;

  if (step === 'mfa-setup') {
    return (
      <form onSubmit={onMfaSetupSubmit} className="flex flex-col gap-3">
        <h1 className="font-mono text-lg">&gt; 2fa --setup</h1>
        <p className="text-xs text-ink-dim">
          Ovaj nalog još nema podešenu dvofaktorsku prijavu, a ona je obavezna za interne uloge.
          Podesite je sada — traje jednom.
        </p>
        {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

        {manualSecret && (
          <div className="rounded border border-border bg-panel-2 p-3">
            <p className="text-xs text-ink-faint">1. skenirajte QR kod autentifikator aplikacijom</p>
            {qrDataUrl && (
              // Beli okvir je namerno fiksan, ne tematski — čitači QR koda traže svetlu
              // podlogu i tamne module; na tamnoj temi bi kod bez ovoga postao nečitljiv.
              <div className="mt-2 flex justify-center rounded bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR kod za podešavanje dvofaktorske prijave" width={220} height={220} />
              </div>
            )}
            <a href={otpauthUrl} className="mt-2 block break-all font-mono text-xs text-accent underline">
              ili otvorite direktno u aplikaciji (na telefonu)
            </a>
            <p className="mt-2 text-xs text-ink-faint">ili unesite ključ ručno:</p>
            <code className="mt-1 block select-all break-all rounded bg-bg px-2 py-1 font-mono text-sm tracking-widest text-ink">
              {manualSecret}
            </code>
          </div>
        )}

        {recoveryCodes.length > 0 && (
          <div className="rounded border border-warn bg-warn-bg p-3">
            <p className="text-xs font-semibold text-ink">
              2. sačuvajte rezervne kodove — prikazuju se SAMO sada
            </p>
            <p className="text-xs text-ink-dim">Svaki važi jednom, za slučaj gubitka telefona.</p>
            <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-ink">
              {recoveryCodes.map((c) => (
                <code key={c} className="select-all rounded bg-bg px-2 py-1">{c}</code>
              ))}
            </div>
          </div>
        )}

        <label className="text-xs text-ink-faint">
          3. unesite prvi 6-cifreni kod iz aplikacije
          <input
            name="code"
            required
            maxLength={6}
            autoFocus
            placeholder="000000"
            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !manualSecret}
          className="rounded bg-accent px-4 py-2 font-mono font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
        >
          ./aktiviraj_2fa
        </button>
      </form>
    );
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
