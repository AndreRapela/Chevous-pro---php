import { DOCUMENT, isPlatformBrowser, registerLocaleData } from '@angular/common';
import { Injectable, PLATFORM_ID, REQUEST, computed, inject, signal } from '@angular/core';
import { convertReferenceAmount } from './reference-currency.util';
import { createTranslationCatalog } from './translation-catalog';
import { patterns, translations } from './translations.en';

export type AppLanguage = 'en' | 'fr';
export type AppCurrency = 'BRL' | 'EUR' | 'USD';
// BRL remains a source currency for historical API amounts, not a site preference.
export type DisplayCurrency = 'EUR' | 'USD';

const LANGUAGE_KEY = 'cvp.language';
const CURRENCY_KEY = 'cvp.currency';

const englishCatalog = createTranslationCatalog(translations, patterns);

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly request = inject(REQUEST, { optional: true });
  private preferredLanguage: AppLanguage = 'en';
  private translateEnglish = englishCatalog;
  private translateFrench?: typeof englishCatalog;
  private frenchRequest?: Promise<boolean>;
  readonly language = signal<AppLanguage>('en');
  readonly currency = signal<DisplayCurrency>(this.readCurrency());
  readonly locale = computed(() => this.language() === 'fr' ? 'fr-FR' : 'en-US');

  constructor() {
    this.applyDocumentLanguage(this.language());
  }

  initialize(): Promise<void> | undefined {
    const cookie = this.browser ? this.document.cookie : this.request?.headers.get('cookie') ?? '';
    const savedLanguage = /(?:^|;\s*)cvp\.language=(en|fr)(?=;|$)/u.exec(cookie)?.[1];
    const language = savedLanguage ?? (this.browser ? this.readLanguage() : 'en');
    if (language === 'fr') return this.setLanguage(language);
    return undefined;
  }

  async setLanguage(language: string): Promise<void> {
    if (language !== 'en' && language !== 'fr') return;
    this.preferredLanguage = language;
    if (language === 'fr' && !(await this.loadFrench())) return;
    if (this.preferredLanguage !== language) return;
    this.language.set(language);
    if (this.browser) {
      this.safeStore(LANGUAGE_KEY, language);
      try {
        const secure = this.document.location.protocol === 'https:' ? '; Secure' : '';
        this.document.cookie = `${LANGUAGE_KEY}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
      } catch { /* Preference cookies may be restricted. */ }
    }
    this.applyDocumentLanguage(language);
  }

  setCurrency(currency: string): void {
    if (currency !== 'EUR' && currency !== 'USD') return;
    this.currency.set(currency);
    this.safeStore(CURRENCY_KEY, currency);
  }

  translate(source: string, knownOnly = false): string {
    const catalog = this.language() === 'fr' ? this.translateFrench ?? this.translateEnglish : this.translateEnglish;
    return catalog(source, knownOnly);
  }

  private loadFrench(): Promise<boolean> {
    this.frenchRequest ??= Promise.all([import('./translations.fr'), import('@angular/common/locales/fr')])
      .then(([french, locale]) => {
        registerLocaleData(locale.default);
        this.translateFrench = createTranslationCatalog(translations, french.patterns, french.translations, true);
        this.translateEnglish = createTranslationCatalog(translations, patterns, french.translations);
        return true;
      })
      .catch(() => {
        this.frenchRequest = undefined;
        return false;
      });
    return this.frenchRequest;
  }

  formatMoney(amount: number, sourceCurrency: AppCurrency = 'BRL', maximumFractionDigits = 2): string {
    if (!Number.isFinite(amount)) return '—';
    const target = this.currency();
    const converted = this.convertAmount(amount, sourceCurrency, target);
    return new Intl.NumberFormat(this.locale(), {
      style: 'currency', currency: target, minimumFractionDigits: 0, maximumFractionDigits
    }).format(converted);
  }

  convertAmount(amount: number, sourceCurrency: AppCurrency, targetCurrency: AppCurrency = this.currency()): number {
    return convertReferenceAmount(amount, sourceCurrency, targetCurrency);
  }

  private readLanguage(): AppLanguage {
    try { const stored = localStorage.getItem(LANGUAGE_KEY); return stored === 'en' || stored === 'fr' ? stored : 'en'; } catch { return 'en'; }
  }

  private readCurrency(): DisplayCurrency {
    try {
      const stored = localStorage.getItem(CURRENCY_KEY);
      return stored === 'USD' ? 'USD' : 'EUR';
    } catch { return 'EUR'; }
  }

  private safeStore(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* Storage may be unavailable in privacy-restricted contexts. */ }
  }

  private applyDocumentLanguage(language: AppLanguage): void {
    this.document.documentElement.lang = language === 'fr' ? 'fr-FR' : 'en-US';
  }
}
