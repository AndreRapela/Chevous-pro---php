import { replaceTranslationFragment } from './localized-text.util';

type Phrases = ReadonlyArray<readonly [source: string, translation: string]>;
type Patterns = ReadonlyArray<readonly [pattern: RegExp, replacement: string]>;

export function createTranslationCatalog(english: Phrases, patterns: Patterns, french?: Phrases, useFrench = false) {
  const entries = english.map(([source, en], index) => ({
    source,
    en,
    fr: french?.[index]?.[1],
    target: useFrench ? french?.[index]?.[1] ?? en : en
  }));
  const exact = new Map<string, string>();
  const knownContent = new Map<string, string>();
  const normalize = (text: string): string => text.normalize('NFC').replace(/\s+/gu, ' ').toLowerCase();
  // Prefer Portuguese and English source text before French aliases such as “Note”.
  for (const key of ['source', 'en', 'fr'] as const) {
    for (const entry of entries) {
      const term = entry[key];
      if (term && !exact.has(term)) exact.set(term, entry.target);
      if (term && !knownContent.has(normalize(term))) knownContent.set(normalize(term), entry.target);
    }
  }
  const ordered = [...entries].sort((left, right) => right.source.length - left.source.length);

  return (source: string, knownOnly = false): string => {
    const value = source.trim();
    if (!value) return source;
    const leading = source.match(/^\s*/)?.[0] ?? '';
    const trailing = source.match(/\s*$/)?.[0] ?? '';
    const translatedExact = exact.get(value);
    if (translatedExact !== undefined) return `${leading}${translatedExact}${trailing}`;
    if (knownOnly) {
      const translated = knownContent.get(normalize(value));
      return translated === undefined ? source : `${leading}${translated}${trailing}`;
    }

    const fromPortuguese = ordered.some((entry) => value.includes(entry.source) && replaceTranslationFragment(value, entry.source, '') !== value);
    const sourceKey = fromPortuguese ? 'source' : 'en';
    let translated = patterns.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
    for (const entry of ordered) {
      const term = entry[sourceKey];
      if (term !== entry.target && translated.includes(term)) {
        translated = replaceTranslationFragment(translated, term, entry.target);
      }
    }
    return `${leading}${translated}${trailing}`;
  };
}
