import { resolveTranslation, hasRequiredTranslationsForPublish } from './language-fallback';

describe('resolveTranslation (M2 spec §2.2 — traženi jezik → engleski → srpski)', () => {
  const translations = [
    { languageCode: 'sr' as const, name: 'Srpski naziv' },
    { languageCode: 'en' as const, name: 'English name' },
    { languageCode: 'de' as const, name: 'Deutscher Name' },
  ];

  it('vraća prevod za tačno traženi jezik kad postoji', () => {
    expect(resolveTranslation(translations, 'de')?.name).toBe('Deutscher Name');
  });

  it('pada na engleski kad traženi jezik ne postoji', () => {
    expect(resolveTranslation(translations, 'fr')?.name).toBe('English name');
  });

  it('pada na srpski kad ni traženi ni engleski ne postoje', () => {
    const noEnglish = translations.filter((t) => t.languageCode !== 'en');
    expect(resolveTranslation(noEnglish, 'fr')?.name).toBe('Srpski naziv');
  });

  it('vraća null kad nema nijednog prevoda', () => {
    expect(resolveTranslation([], 'sr')).toBeNull();
  });
});

describe('hasRequiredTranslationsForPublish (M2 spec §2.2 — sr+en obavezni pre ACTIVE)', () => {
  it('true kad postoje i sr i en', () => {
    expect(hasRequiredTranslationsForPublish([{ languageCode: 'sr' }, { languageCode: 'en' }])).toBe(true);
  });

  it('false kad nedostaje sr', () => {
    expect(hasRequiredTranslationsForPublish([{ languageCode: 'en' }])).toBe(false);
  });

  it('false kad nedostaje en', () => {
    expect(hasRequiredTranslationsForPublish([{ languageCode: 'sr' }])).toBe(false);
  });

  it('false kad nema nijednog prevoda', () => {
    expect(hasRequiredTranslationsForPublish([])).toBe(false);
  });
});
