import createNextIntlPlugin from 'next-intl/plugin';

// M8 spec §1 dopuna (BFF arhitektura) — Next.js server je jedini pozivalac
// apps/api; API_BASE_URL se čita u src/lib/api-client.ts, ne ovde.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
