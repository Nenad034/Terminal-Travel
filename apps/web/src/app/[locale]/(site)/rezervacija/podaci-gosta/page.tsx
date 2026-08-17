import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import GuestCheckoutForm from './GuestCheckoutForm';

// M8 spec poglavlje 3, korak 3 — podaci gosta. Gost bira: prijava, registracija, ili
// "nastavi bez naloga" (dopuna avgust 2026 — GuestCheckoutForm, POST /crm/client-accounts/
// guest-checkout preko M6). Ovaj korak i dalje traži samo ime putnika za ugovor/vaučer
// (M5 ConfirmQuoteDto.buyerName). Detaljan GuestProfile (putni dokument) ostaje za /nalog/profil.
export default async function GuestInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'booking.guestInfo' });
  const session = await getSession();

  const forward = new URLSearchParams({
    productId: sp.productId ?? '',
    stayFrom: sp.stayFrom ?? '',
    stayTo: sp.stayTo ?? '',
    adults: sp.adults ?? '2',
    children: sp.children ?? '0',
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>

      {!session && (
        <p className="mb-4 rounded-md bg-accent-soft p-3 text-sm">
          {t('loginPrompt')}{' '}
          <a href={`/${locale}/nalog/prijava`} className="font-medium text-accent underline">
            {t('loginLink')}
          </a>{' '}
          {t('registerPrompt')}{' '}
          <a href={`/${locale}/nalog/registracija`} className="font-medium text-accent underline">
            {t('registerLink')}
          </a>
        </p>
      )}

      {!session && (
        <GuestCheckoutForm
          labels={{
            continueAsGuest: t('continueAsGuest'),
            fullName: t('fullName'),
            email: t('email'),
            phone: t('phone'),
            submit: t('submit'),
          }}
        />
      )}

      <form action={`/${locale}/rezervacija/uslovi`} method="get" className="flex flex-col gap-3">
        {[...forward.entries()].map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="text-sm">
          {t('fullName')}
          <input name="buyerName" required className="mt-1 w-full rounded-md border border-border px-3 py-2" />
        </label>
        <button
          type="submit"
          disabled={!session}
          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-50"
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}
