import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

// M8 spec poglavlje 2 — sve rute prefiksovane jezikom (/sr/..., /en/...).
export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
