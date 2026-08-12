// M2 spec §... — 8 podržanih jezika (ProductTranslation.language_code), primenjeno
// ovde na URL prefiks sajta (M8 spec poglavlje 2: /sr/..., /en/..., ...).
export const locales = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'] as const;
export type Locale = (typeof locales)[number];

// M2 spec — fallback red: engleski pa srpski za NEDOSTAJUĆI prevod proizvoda.
// UI stringovi sajta (ne proizvodi) padaju na srpski jer je to jezik agencije.
export const defaultLocale: Locale = 'sr';
