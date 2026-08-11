import { LanguageCode, ProductTranslation } from '@prisma/client';

/**
 * M2 spec §2.2 — "Pravilo padanja unazad (fallback): ako prevod za traženi jezik ne
 * postoji, prikazuje se prvo engleski, pa srpski, tim redosledom."
 */
export function resolveTranslation<T extends { languageCode: LanguageCode }>(
  translations: T[],
  requestedLang: LanguageCode,
): T | null {
  const byLang = (lang: LanguageCode) => translations.find((t) => t.languageCode === lang) ?? null;
  return byLang(requestedLang) ?? byLang('en') ?? byLang('sr') ?? null;
}

/** M2 spec §2.2 — sr i en su obavezni pre DRAFT → ACTIVE. */
export function hasRequiredTranslationsForPublish(translations: Pick<ProductTranslation, 'languageCode'>[]): boolean {
  const langs = new Set(translations.map((t) => t.languageCode));
  return langs.has('sr') && langs.has('en');
}
