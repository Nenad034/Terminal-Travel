import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Tudja biblioteka, kopirana ovde skriptom `scripts/copy-maplibre-worker.mjs`
      // (postinstall) — nije nas kod i ne sme se ispravljati. Davala je 1058 od 1166
      // upozorenja i time potpuno zatrpavala nase nalaze.
      "public/maplibre/**",
    ],
  },
];

export default eslintConfig;
