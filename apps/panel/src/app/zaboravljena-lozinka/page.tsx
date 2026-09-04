import ForgotPasswordForm from './ForgotPasswordForm';

// M1 spec §5 (dopuna 4.9.2026) — traženje linka za promenu lozinke.
export default function ZaboravljenaLozinkaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-5">
      <div className="w-full max-w-sm rounded-lg border border-border bg-panel p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent font-mono font-bold text-accent-ink">
            T
          </div>
          <b className="font-mono tracking-wide">TERMINAL</b>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
