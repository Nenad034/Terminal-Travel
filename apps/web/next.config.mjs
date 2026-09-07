import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';

// M8 spec §1 dopuna (BFF arhitektura) — Next.js server je jedini pozivalac
// apps/api; API_BASE_URL se čita u src/lib/api-client.ts, ne ovde.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 7.9.2026 — potrebno za pakovanje u sliku (infra/docker/web.Dockerfile).
  // Next tada sklopi minimalan samostalan izlaz sa samo onim zavisnostima koje kod
  // stvarno uvozi, umesto da se u sliku prepisuje celo stablo monorepa.
  // Ne utiče na `next dev` — važi samo za `next build`.
  output: 'standalone',
  // Koren monorepa, da Next zna dokle da ide kad skuplja zavisnosti (bez ovoga
  // u workspace-u ume da pogreši koren i izostavi deo paketa).
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
};

export default withNextIntl(nextConfig);
