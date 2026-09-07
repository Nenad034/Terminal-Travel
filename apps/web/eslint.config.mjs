import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  // Mora biti poslednji — gasi stilistička ESLint pravila koja bi se sudarala sa Prettierom
  // (koji sad formatira ceo repo, dok. 39, poglavlje Prettier).
  prettierConfig,
];

export default eslintConfig;
