// M17 spec §2 — panel nema sopstvenu bazu/poslovnu logiku, samo poziva apps/api preko
// API_BASE_URL (čita se u src/lib/api-client.ts). Za razliku od apps/web (M8) nema next-intl
// jer je M17 isključivo za interni srpski tim (M17 zadatak — "Kontekst" napomena, avgust 2026).
import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 7.9.2026 — potrebno za pakovanje u sliku (infra/docker/panel.Dockerfile).
  // Next tada sklopi minimalan samostalan izlaz sa samo onim zavisnostima koje kod
  // stvarno uvozi, umesto da se u sliku prepisuje celo stablo monorepa.
  // Ne utiče na `next dev` — važi samo za `next build`.
  output: 'standalone',
  // Koren monorepa, da Next zna dokle da ide kad skuplja zavisnosti (bez ovoga
  // u workspace-u ume da pogreši koren i izostavi deo paketa).
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
};

export default nextConfig;
