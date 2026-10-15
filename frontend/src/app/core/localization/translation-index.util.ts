import type { TranslationEntry } from './translations.data';

type SourceLanguage = 'pt' | 'en' | 'fr';
export type TranslationIndex = Record<SourceLanguage, ReadonlyMap<string, TranslationEntry>>;

/** Preserve first-match and PT → EN → FR precedence without repeatedly scanning the dictionary. */
export function createTranslationIndex(entries: readonly TranslationEntry[]): TranslationIndex {
  const index = {
    pt: new Map<string, TranslationEntry>(),
    en: new Map<string, TranslationEntry>(),
    fr: new Map<string, TranslationEntry>()
  };
  for (const entry of entries) {
    for (const language of ['pt', 'en', 'fr'] as const) {
      if (!index[language].has(entry[language])) index[language].set(entry[language], entry);
    }
  }
  return index;
}

export function findExactTranslation(
  index: TranslationIndex,
  value: string
): TranslationEntry | undefined {
  return index.pt.get(value) ?? index.en.get(value) ?? index.fr.get(value);
}
