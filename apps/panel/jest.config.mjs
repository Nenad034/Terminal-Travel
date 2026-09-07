import nextJest from 'next/jest.js';

// Nalaz 2.4b (dok. 39) — apps/panel (42.000 linija) do 7.9.2026 nije imao nijedan test.
// `next/jest` (ugrađen u `next`) rešava SWC transform + CSS/asset mock-ove umesto ručne
// Babel konfiguracije — standardan obrazac za App Router.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
};

export default createJestConfig(config);
