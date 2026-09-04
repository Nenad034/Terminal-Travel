import ActivationForm from './ActivationForm';

// M1 spec §5/§7 (dopuna 4.9.2026) — pozvani kolega stiže ovde preko linka koji mu pozivalac
// prosledi (`/aktivacija?token=…`). Ista ljuska kao stranica prijave; nema provere sesije jer
// je pozvani po definiciji još nema.
export default async function AktivacijaPage({
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
          <ActivationForm token={token} />
        ) : (
          <p className="rounded bg-danger-bg p-3 text-sm text-danger">
            Link nije potpun — nedostaje deo posle <code>?token=</code>. Zatražite novu pozivnicu od
            osobe koja vam je otvorila nalog.
          </p>
        )}
      </div>
    </div>
  );
}
