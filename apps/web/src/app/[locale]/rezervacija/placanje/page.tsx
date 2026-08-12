import { getTranslations } from 'next-intl/server';
import { payByBankTransferAction, payByCardAction } from '../actions';

// M8 spec poglavlje 3, korak 5 — plaćanje. quoteId dolazi iz koraka 4 (Quote već
// postoji, contract_terms_accepted = true).
export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'booking.payment' });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>

      {sp.greska && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">Plaćanje nije uspelo, pokušajte ponovo.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form action={payByCardAction} className="rounded-lg border border-gray-200 p-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="quoteId" value={sp.quoteId ?? ''} />
          <input type="hidden" name="buyerName" value={sp.buyerName ?? ''} />
          <button type="submit" className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
            {t('card')}
          </button>
        </form>

        <form action={payByBankTransferAction} className="rounded-lg border border-gray-200 p-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="quoteId" value={sp.quoteId ?? ''} />
          <input type="hidden" name="buyerName" value={sp.buyerName ?? ''} />
          <button type="submit" className="w-full rounded-md border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-light">
            {t('bankTransfer')}
          </button>
        </form>
      </div>
    </div>
  );
}
