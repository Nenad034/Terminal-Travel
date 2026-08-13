import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

// M8 spec poglavlje 2 — sve rute prefiksovane jezikom (/sr/..., /en/...).
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

// M8 spec poglavlje 3, korak 0 (M12 poglavlje 3a) — hvatanje ?ref=<tracking_code> pri dolasku
// sa marketinškog linka; čist prolazan podatak, ne validira se ovde. Čuva se na strani klijenta
// (kolačić, ne server-side baza) do trenutka kreiranja Quote (rezervacija/actions.ts).
export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const ref = request.nextUrl.searchParams.get('ref');
  if (ref) {
    response.cookies.set('tt_ref', ref, { maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', path: '/' });
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
