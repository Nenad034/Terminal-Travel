import { getTranslations } from 'next-intl/server';
import { acceptTermsAndCreateQuoteAction } from '../actions';

// M8 spec poglavlje 3, korak 4 — clickwrap. Submit ovde kreira M5 Quote sa
// contract_terms_accepted = true (vidi napomenu u rezervacija/actions.ts).
export default async function TermsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'booking.terms' });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>

      <div className="mb-6 max-h-64 overflow-y-auto rounded-md border border-border p-4 text-sm text-ink-dim">
        {/* M20 spec §2.3 — puni tekst ugovora se generiše po rezervaciji tek posle
            potvrde (ClientContract.content_snapshot); ovde stoji opšti tekst uslova
            (isti kao statična /uslovi stranica) jer Booking još ne postoji. */}
        <StaticTermsText />
      </div>

      <form action={acceptTermsAndCreateQuoteAction} className="flex flex-col gap-4">
        {Object.entries(sp).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v ?? ''} />
        ))}
        <input type="hidden" name="locale" value={locale} />

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required name="accepted" className="mt-1" />
          {t('accept')}
        </label>

        <button type="submit" className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong">
          {t('submit')}
        </button>
      </form>
    </div>
  );
}

function StaticTermsText() {
  return (
    <p>
      Ugovor o organizovanju putovanja/posredovanju sastavlja se automatski po potvrdi rezervacije
      (M20) i sadrži: podatke agencije, cenu, itinerar, uslove otkazivanja, garanciju putovanja i
      dinamiku plaćanja. Pun tekst dobijate uz potvrdu rezervacije.
    </p>
  );
}
