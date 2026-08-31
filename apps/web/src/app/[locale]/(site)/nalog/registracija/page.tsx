import { getTranslations } from 'next-intl/server';
import RegisterForm from './RegisterForm';


export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.register' });

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <RegisterForm
        locale={locale}
        labels={{
          fullName: t('fullName'),
          email: t('email'),
          phone: t('phone'),
          password: t('password'),
          submit: t('submit'),
          hasAccount: t('hasAccount'),
          loginLink: t('loginLink'),
        }}
      />
    </div>
  );
}
