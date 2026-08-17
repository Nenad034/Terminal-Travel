import { getTranslations } from 'next-intl/server';
import LoginForm from './LoginForm';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.login' });

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <LoginForm
        locale={locale}
        labels={{
          email: t('email'),
          password: t('password'),
          submit: t('submit'),
          noAccount: t('noAccount'),
          registerLink: t('registerLink'),
        }}
      />
    </div>
  );
}
