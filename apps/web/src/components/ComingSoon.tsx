import { getTranslations } from 'next-intl/server';

// M8 spec §9a — rute koje zavise od M12/M15/M23 (bez koda u ovom prolazu implementacije).
export default async function ComingSoon({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'comingSoon' });
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-2 text-ink-faint">{t('body')}</p>
    </div>
  );
}
