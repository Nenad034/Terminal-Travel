'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// M1 spec §5 — POST /iam/auth/login preko Route Handler-a (/api/session/login), koji
// jedini sme da upiše httpOnly sesijski kolačić (session.ts). Client komponenta samo
// šalje formu i čita rezultat, JWT ne prolazi kroz ovaj kod.
export default function LoginForm({
  locale,
  labels,
}: {
  locale: string;
  labels: { email: string; password: string; submit: string; noAccount: string; registerLink: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      setError('Nalog ima uključenu dvofaktorsku autentikaciju — ovaj ekran je van obima prvog prolaza.');
      return;
    }
    router.push(`/${locale}/nalog/moje-rezervacije`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {error && <p className="rounded-md bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <label className="text-sm">
        {labels.email}
        <input type="email" name="email" required className="mt-1 w-full rounded-md border border-border px-3 py-2" />
      </label>
      <label className="text-sm">
        {labels.password}
        <input type="password" name="password" required className="mt-1 w-full rounded-md border border-border px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-50">
        {labels.submit}
      </button>
      <p className="text-sm text-ink-faint">
        {labels.noAccount}{' '}
        <Link href={`/${locale}/nalog/registracija`} className="font-medium text-accent underline">
          {labels.registerLink}
        </Link>
      </p>
    </form>
  );
}
