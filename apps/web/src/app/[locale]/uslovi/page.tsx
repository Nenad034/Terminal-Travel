import { getTranslations } from 'next-intl/server';

export default async function TermsStaticPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'footer' });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">{t('terms')}</h1>
      <p className="text-ink-dim">
        Opšti uslovi poslovanja Terminal Travel agencije. Detaljan ugovor za konkretnu rezervaciju
        (M20) generiše se automatski po potvrdi rezervacije i sadrži podatke agencije, cenu,
        itinerar, uslove otkazivanja, garanciju putovanja i dinamiku plaćanja.
      </p>
    </div>
  );
}
