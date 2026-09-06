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
  {
    // Podešavanja pravila. Pravilo se menja SAMO uz obrazloženje ovde — bez toga sledeća sesija
    // ne zna da li je izuzetak odluka ili nemar (6.9.2026, razvrstavanje u
    // `docs/analize/41-ESLINT-PANEL-RAZVRSTAVANJE.md`, gomila C).
    rules: {
      // Ime sa donjom crtom znači „namerno neiskorišćeno". Potrebno je zbog potpisa koje ne
      // biramo mi: `useActionState` akcija uvek prima prethodno stanje (`_prev`), a route
      // handler zahtev (`_req`), i kad ih telo ne koristi. 79 od 84 prijave bilo je toga.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // UPOZORENJE, ne greška — i to je merena odluka, ne popuštanje. Od 32 prijave u prvom
      // prolazu, 19 je bio NAMERAN i jedini ispravan obrazac u SSR-u: vrednost iz pregledača
      // (`localStorage`, tema, vreme) sme da se pročita tek posle hidratacije, jer server i prvi
      // klijentski render moraju biti identični. Raniji oblik, koji je čitao `localStorage`
      // direktno u `useState` inicijalizatoru, napravio je prijavljenu „Hydration failed" grešku
      // (21.8.2026) — ispravka te greške je upravo ono što ovo pravilo sada prijavljuje.
      // Osam ih briše stari podatak pre novog dohvatanja, što je takođe ispravno.
      // Alat te slučajeve ne razlikuje od stvarnih, a 27 `eslint-disable` komentara bi pravilo
      // učinilo nečitljivim. Kao upozorenje ostaje vidljivo onome ko pokrene lint, a ne obara CI.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
