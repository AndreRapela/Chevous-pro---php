import { DOCUMENT, registerLocaleData } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import localeFr from '@angular/common/locales/fr';
import { replaceTranslationFragment } from './localized-text.util';
import { convertReferenceAmount } from './reference-currency.util';
import { TRANSLATIONS } from './translations.data';
import { createTranslationIndex, findExactTranslation } from './translation-index.util';

registerLocaleData(localeFr);

export type AppLanguage = 'en' | 'fr';
export type AppCurrency = 'BRL' | 'EUR' | 'USD';
// BRL remains a source currency for historical API amounts, not a site preference.
export type DisplayCurrency = 'EUR' | 'USD';

const LANGUAGE_KEY = 'cvp.language';
const CURRENCY_KEY = 'cvp.currency';
const TRANSLATION_INDEX = createTranslationIndex(TRANSLATIONS);

// A ordem é invariável. Calculá-la uma única vez evita uma ordenação para cada
// nó de texto observado pela camada de localização.
const ORDERED_TRANSLATIONS = [...TRANSLATIONS].sort(
  (left, right) => right.pt.length - left.pt.length
);

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  private readonly document = inject(DOCUMENT);
  readonly language = signal<AppLanguage>(this.readLanguage());
  readonly currency = signal<DisplayCurrency>(this.readCurrency());
  readonly locale = computed(() => (this.language() === 'fr' ? 'fr-FR' : 'en-US'));

  constructor() {
    this.applyDocumentLanguage(this.language());
  }

  setLanguage(language: string): void {
    if (language !== 'en' && language !== 'fr') return;
    this.language.set(language);
    this.safeStore(LANGUAGE_KEY, language);
    this.applyDocumentLanguage(language);
  }

  setCurrency(currency: string): void {
    if (currency !== 'EUR' && currency !== 'USD') return;
    this.currency.set(currency);
    this.safeStore(CURRENCY_KEY, currency);
  }

  translate(source: string): string {
    if (!source || !source.trim()) return source;
    const language = this.language();
    const leading = source.match(/^\s*/)?.[0] ?? '';
    const trailing = source.match(/\s*$/)?.[0] ?? '';
    const value = source.trim();
    // Templates originate in PT, SSR emits EN. Prefer those source keys before
    // FR targets: otherwise English "Note" can be mistaken for the rating label.
    const exact = findExactTranslation(TRANSLATION_INDEX, value);
    if (exact) return `${leading}${exact[language]}${trailing}`;

    const sourceLanguage: 'pt' | 'en' = ORDERED_TRANSLATIONS.some(
      (entry) =>
        value.includes(entry.pt) && replaceTranslationFragment(value, entry.pt, '') !== value
    )
      ? 'pt'
      : 'en';
    // Frases com variáveis ("5 profissionais", por exemplo) precisam ser
    // resolvidas antes de traduzir palavras isoladas; caso contrário sobra
    // uma interface híbrida como "Professionals for sua casa".
    let translated = this.translatePatterns(value, language);
    for (const entry of ORDERED_TRANSLATIONS) {
      const target = entry[language];
      const sourceValue = entry[sourceLanguage];
      if (sourceValue && translated.includes(sourceValue))
        translated = replaceTranslationFragment(translated, sourceValue, target);
    }
    return `${leading}${translated}${trailing}`;
  }

  formatMoney(
    amount: number,
    sourceCurrency: AppCurrency = 'BRL',
    maximumFractionDigits = 2
  ): string {
    if (!Number.isFinite(amount)) return '—';
    const target = this.currency();
    const converted = this.convertAmount(amount, sourceCurrency, target);
    return new Intl.NumberFormat(this.locale(), {
      style: 'currency',
      currency: target,
      minimumFractionDigits: 0,
      maximumFractionDigits
    }).format(converted);
  }

  convertAmount(
    amount: number,
    sourceCurrency: AppCurrency,
    targetCurrency: AppCurrency = this.currency()
  ): number {
    return convertReferenceAmount(amount, sourceCurrency, targetCurrency);
  }

  private translatePatterns(value: string, language: AppLanguage): string {
    const replacements: Array<[RegExp, string]> =
      language === 'fr'
        ? [
            [/Etapa (\d+) de (\d+)/g, 'Étape $1 sur $2'],
            [/Step (\d+) of (\d+)/g, 'Étape $1 sur $2'],
            [
              /Showing (\d+)–(\d+) of (\d+) professionals/g,
              'Affichage de $1 à $2 sur $3 professionnels'
            ],
            [/Showing (\d+)–(\d+) of (\d+) services/g, 'Affichage de $1 à $2 sur $3 services'],
            [
              /Showing (\d+) of (\d+) results · page (\d+) of (\d+)/g,
              'Affichage de $1 sur $2 résultats · page $3 sur $4'
            ],
            [/(\d+) serviços concluídos/g, '$1 services terminés'],
            [/(\d+) anos de experiência/g, '$1 ans d’expérience'],
            [
              /Mostrando (\d+)–(\d+) de (\d+) profissionais/g,
              'Affichage de $1 à $2 sur $3 professionnels'
            ],
            [/Mostrando (\d+)–(\d+) de (\d+) serviços/g, 'Affichage de $1 à $2 sur $3 services'],
            [
              /Mostrando (\d+) de (\d+) registros · página (\d+) de (\d+)/g,
              'Affichage de $1 sur $2 résultats · page $3 sur $4'
            ],
            [/(\d+) serviços disponíveis/g, '$1 services disponibles'],
            [/(\d+) serviços/g, '$1 services'],
            [/(\d+) profissionais/g, '$1 professionnels'],
            [/(\d+) opções/g, '$1 options'],
            [/(\d+) opção/g, '$1 option'],
            [/Abrir painel de (.+)/g, 'Ouvrir le tableau de bord de $1'],
            [/Remover (.+) dos favoritos/g, 'Supprimer $1 des favoris'],
            [/Profissionais para (.+)/g, 'Professionnels pour $1'],
            [/A partir de (.+)/g, 'À partir de $1']
          ]
        : [
            [/Etapa (\d+) de (\d+)/g, 'Step $1 of $2'],
            [/Step (\d+) of (\d+)/g, 'Step $1 of $2'],
            [/Showing (\d+)–(\d+) of (\d+) professionals/g, 'Showing $1–$2 of $3 professionals'],
            [/Showing (\d+)–(\d+) of (\d+) services/g, 'Showing $1–$2 of $3 services'],
            [
              /Showing (\d+) of (\d+) results · page (\d+) of (\d+)/g,
              'Showing $1 of $2 results · page $3 of $4'
            ],
            [/(\d+) serviços concluídos/g, '$1 completed services'],
            [/(\d+) anos de experiência/g, '$1 years of experience'],
            [/Mostrando (\d+)–(\d+) de (\d+) profissionais/g, 'Showing $1–$2 of $3 professionals'],
            [/Mostrando (\d+)–(\d+) de (\d+) serviços/g, 'Showing $1–$2 of $3 services'],
            [
              /Mostrando (\d+) de (\d+) registros · página (\d+) de (\d+)/g,
              'Showing $1 of $2 results · page $3 of $4'
            ],
            [/(\d+) serviços disponíveis/g, '$1 services available'],
            [/(\d+) serviços/g, '$1 services'],
            [/(\d+) profissionais/g, '$1 professionals'],
            [/(\d+) opções/g, '$1 options'],
            [/(\d+) opção/g, '$1 option'],
            [/Abrir painel de (.+)/g, "Open $1's dashboard"],
            [/Remover (.+) dos favoritos/g, 'Remove $1 from favorites'],
            [/Profissionais para (.+)/g, 'Professionals for $1'],
            [/A partir de (.+)/g, 'From $1']
          ];
    return replacements.reduce(
      (result, [pattern, replacement]) => result.replace(pattern, replacement),
      value
    );
  }

  private readLanguage(): AppLanguage {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      return stored === 'en' || stored === 'fr' ? stored : 'en';
    } catch {
      return 'en';
    }
  }

  private readCurrency(): DisplayCurrency {
    try {
      const stored = localStorage.getItem(CURRENCY_KEY);
      return stored === 'USD' ? 'USD' : 'EUR';
    } catch {
      return 'EUR';
    }
  }

  private safeStore(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage may be unavailable in privacy-restricted contexts. */
    }
  }

  private applyDocumentLanguage(language: AppLanguage): void {
    this.document.documentElement.lang = language === 'fr' ? 'fr-FR' : 'en-US';
  }
}
