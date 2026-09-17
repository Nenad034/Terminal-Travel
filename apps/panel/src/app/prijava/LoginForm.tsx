'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Izgled: dizajn dok. 29 §6i / M17 §3.0 (17.9.2026) — kartica u sredini „naslovne strane radnog
// dana" (LoginStage.tsx); sva tri koraka žive u ISTOJ kartici na istoj ruti, naslov iznad
// kartice prati korak. Tok je nepromenjen:
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
  // Dizajn dok. §6i — „Zapamti me na ovom uređaju": podrazumevano isključeno (sesijski kolačić).
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      body: JSON.stringify({ mfaToken, code: form.get('code'), remember }),
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
      body: JSON.stringify({ action: 'confirm', setupToken, code: form.get('code'), remember }),
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
  const manualSecret = otpauthUrl
    ? new URLSearchParams(otpauthUrl.split('?')[1] ?? '').get('secret')
    : null;

  const headline =
    step === 'mfa-setup' ? (
      <>
        <h1>Podesite dvofaktorsku prijavu.</h1>
        <p className="lede">
          Ovaj nalog još nema 2FA, a ona je obavezna za interne uloge. Traje jednom.
        </p>
      </>
    ) : step === 'mfa' ? (
      <>
        <h1>Još jedan korak.</h1>
        <p className="lede">
          6-cifreni kod iz autentifikator aplikacije. Obavezno za interne uloge.
        </p>
      </>
    ) : (
      <>
        <h1>
          Današnje rezervacije <em>su već tu.</em>
        </h1>
        <p className="lede">
          Provizije, marže i noćne brojke, spremne pre nego što ste stigli. Prijavite se i
          pogledajte šta se promenilo od juče.
        </p>
      </>
    );

  let card: React.ReactNode;

  if (step === 'mfa-setup') {
    card = (
      <form onSubmit={onMfaSetupSubmit} className="setup">
        {error && <p className="error">{error}</p>}
        {manualSecret && (
          <div>
            <label>1. skenirajte QR kod autentifikator aplikacijom</label>
            {qrDataUrl && (
              // Beli okvir je namerno fiksan, ne tematski — čitači QR koda traže svetlu
              // podlogu i tamne module; na tamnoj pozadini bi kod bez ovoga postao nečitljiv.
              <div className="qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR kod za podešavanje dvofaktorske prijave"
                  width={200}
                  height={200}
                />
              </div>
            )}
            <a href={otpauthUrl} className="under" style={{ display: 'block', marginTop: 6 }}>
              ili otvorite direktno u aplikaciji (na telefonu)
            </a>
            <label style={{ marginTop: 8 }}>ili unesite ključ ručno</label>
            <code>{manualSecret}</code>
          </div>
        )}
        {recoveryCodes.length > 0 && (
          <div className="warn">
            <label>2. sačuvajte rezervne kodove — prikazuju se SAMO sada</label>
            <p style={{ margin: '4px 0 8px' }}>Svaki važi jednom, za slučaj gubitka telefona.</p>
            <div className="codes">
              {recoveryCodes.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </div>
          </div>
        )}
        <div>
          <label htmlFor="mfa-setup-code">3. unesite prvi 6-cifreni kod iz aplikacije</label>
          <div className="field">
            <input
              id="mfa-setup-code"
              name="code"
              required
              maxLength={6}
              autoFocus
              inputMode="numeric"
              placeholder="000000"
              className="code"
            />
          </div>
        </div>
        <button type="submit" className="btn" disabled={pending || !manualSecret}>
          Aktiviraj 2FA <span aria-hidden="true">→</span>
        </button>
      </form>
    );
  } else if (step === 'mfa') {
    card = (
      <form onSubmit={onMfaSubmit}>
        {error && <p className="error">{error}</p>}
        <div>
          <label htmlFor="mfa-code">Kod iz aplikacije</label>
          <div className="field">
            <input
              id="mfa-code"
              name="code"
              required
              maxLength={6}
              autoFocus
              inputMode="numeric"
              placeholder="000000"
              className="code"
            />
          </div>
        </div>
        <button type="submit" className="btn" disabled={pending}>
          Potvrdi <span aria-hidden="true">→</span>
        </button>
      </form>
    );
  } else {
    card = (
      <form onSubmit={onCredentialsSubmit}>
        {error && <p className="error">{error}</p>}
        <div>
          <label htmlFor="login-email">Email</label>
          <div className="field">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <input
              id="login-email"
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="username"
            />
          </div>
        </div>
        <div>
          <label htmlFor="login-password">Lozinka</label>
          <div className="field">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden
            >
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'}
              aria-pressed={showPassword}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
              >
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
        <div className="row">
          <label htmlFor="login-remember">
            <input
              id="login-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{' '}
            Zapamti me na ovom uređaju
          </label>
          <span className="twofa">
            <i />
            2FA · sledeći korak
          </span>
        </div>
        <button type="submit" className="btn" disabled={pending}>
          Otvori panel <span aria-hidden="true">→</span>
        </button>
        <div className="under">
          Zaključani ste? <Link href="/zaboravljena-lozinka">Zaboravljena lozinka</Link> · ili
          javite Vlasniku
        </div>
      </form>
    );
  }

  return (
    <div className="left">
      <div>{headline}</div>
      <div className="card">{card}</div>
    </div>
  );
}
