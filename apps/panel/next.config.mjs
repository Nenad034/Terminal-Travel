// M17 spec §2 — panel nema sopstvenu bazu/poslovnu logiku, samo poziva apps/api preko
// API_BASE_URL (čita se u src/lib/api-client.ts). Za razliku od apps/web (M8) nema next-intl
// jer je M17 isključivo za interni srpski tim (M17 zadatak — "Kontekst" napomena, avgust 2026).
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
