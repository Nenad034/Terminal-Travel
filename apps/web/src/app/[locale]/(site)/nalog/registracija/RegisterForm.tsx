'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// M1 spec §5 — POST /iam/auth/register preko Route Handler-a (/api/session/register).
export default function RegisterForm({
  locale,
  labels,
}: {
  locale: string;
  labels: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    submit: string;
    hasAccount: string;
    loginLink: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/session/register', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
        fullName: form.get('fullName'),
        phone: form.get('phone') || undefined,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(body?.message ?? 'Registracija nije uspela.');
      return;
    }
    router.push(`/${locale}/nalog/moje-rezervacije`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {error && <p className="rounded-md bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <label className="text-sm">
        {labels.fullName}
        <input name="fullName" required className="mt-1 w-full rounded-md border border-border px-3 py-2" />
      </label>
      <label className="text-sm">
        {labels.email}
        <input type="email" name="email" required className="mt-1 w-full rounded-md border border-border px-3 py-2" />
      </label>
      <label className="text-sm">
        {labels.phone}
        <input name="phone" className="mt-1 w-full rounded-md border border-border px-3 py-2" />
      </label>
      <label className="text-sm">
        {labels.password}
        <input type="password" name="password" required minLength={12} className="mt-1 w-full rounded-md border border-border px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-50">
        {labels.submit}
      </button>
      <p className="text-sm text-ink-faint">
        {labels.hasAccount}{' '}
        <Link href={`/${locale}/nalog/prijava`} className="font-medium text-accent underline">
          {labels.loginLink}
        </Link>
      </p>
    </form>
  );
}
