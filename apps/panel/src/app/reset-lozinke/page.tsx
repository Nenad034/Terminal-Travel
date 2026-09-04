import ResetPasswordForm from './ResetPasswordForm';

// M1 spec §5/§7 (dopuna 4.9.2026) — odredište linka iz poruke o promeni lozinke.
export default async function ResetLozinkePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-5">
      <div className="w-full max-w-sm rounded-lg border border-border bg-panel p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent font-mono font-bold text-accent-ink">
            T
          </div>
          <b className="font-mono tracking-wide">TERMINAL</b>
        </div>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="rounded bg-danger-bg p-3 text-sm text-danger">
            Link nije potpun — nedostaje deo posle <code>?token=</code>. Zatražite nov link na stranici
            „zaboravljena lozinka".
          </p>
        )}
      </div>
    </div>
  );
}
