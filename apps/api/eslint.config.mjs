import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

// Nalaz 3.2 (dok. 39) — apps/api (65.000 linija) nije imao ESLint uopšte; panel i sajt su
// ga već imali. Isto podešavanje kao apps/panel/eslint.config.mjs — flat config, pravilo
// se menja SAMO uz obrazloženje ovde.
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    rules: {
      // Nalaz 3.3 (dok. 39) — 189 postojećih upotreba `any` u produkcijskom kodu, baš onakva
      // rupa koja je pustila `base_beds` grešku do ekrana (dok. 39, poglavlje 3.3). Upozorenje,
      // ne greška: pravilo je da se `any` ne dodaje u NOV kod, a postojeći se čisti u fajlu koji
      // se ionako dira — masovna izmena nije cilj ovog prolaza.
      '@typescript-eslint/no-explicit-any': 'warn',

      // NestJS DI konstruktori i DTO klase legalno imaju parametre/polja koja telo metode ne
      // koristi direktno (npr. @Body() dto: X kad se dto prosleđuje dalje u celini). Isti obrazac
      // kao panel (eslint.config.mjs) — "_" prefiks znači namerno neiskorišćeno.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  // Mora biti poslednji — gasi stilistička ESLint pravila koja bi se sudarala sa Prettierom
  // (koji sad formatira ceo repo, dok. 39, poglavlje Prettier).
  prettierConfig,
);
