'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// M8 spec poglavlje 3, korak 3 (dopuna avgust 2026) — "nastavi kao gost bez naloga".
// Uspešan poziv upisuje httpOnly sesijski kolačić (isti mehanizam kao prijava/registracija) i
// osvežava stranicu — GuestInfoPage (server component) tad vidi session i otključava dugme "Nastavi".
export default function GuestCheckoutForm({
  labels,
}: {
  labels: { continueAsGuest: string; fullName: string; email: string; phone: string; submit: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/session/guest-checkout', {
      method: 'POST',
      body: JSON.stringify({
        fullName: form.get('fullName'),
        email: form.get('email'),
        phone: form.get('phone') || undefined,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? 'Nastavak bez naloga nije uspeo, pokušajte ponovo.');
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent"
      >
        {labels.continueAsGuest}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-3 rounded-md border border-border p-4">
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-accent px-4 py-2 font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
      >
        {labels.submit}
      </button>
    </form>
  );
}
