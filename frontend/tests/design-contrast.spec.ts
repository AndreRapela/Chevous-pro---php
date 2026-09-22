import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Palette/selector regressions, not a substitute for browser or full WCAG auditing.
const source = readFileSync(new URL('../src/styles.scss', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const variables = new Map([...source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)].map(match => [match[1], match[2].trim()]));
const rules = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selectors: match[1].split(',').map(value => value.trim()), declarations: match[2] }));

function declaration(selector: string, property: string): string {
  let result = '';
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue;
    for (const match of rule.declarations.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) if (match[1] === property) result = match[2].trim();
  }
  assert.ok(result, `${selector} must define ${property}`);
  return result;
}

function resolve(value: string): string {
  if (!value.startsWith('var(')) return value;
  const key = value.slice(4, -1);
  const target = variables.get(key);
  assert.ok(target, `Missing palette token ${key}`);
  assert.notEqual(target, value, 'Palette tokens must not resolve to themselves.');
  return resolve(target);
}

function luminance(color: string): number {
  assert.match(color, /^#[0-9a-f]{6}$/i);
  const values = color.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const a = luminance(resolve(first)), b = luminance(resolve(second));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('warm accents on a single neutral-blue theme', () => {
  it('keeps secondary reading text above 4.5:1 across the main light surfaces', () => {
    for (const background of ['--surface', '--surface-soft', '--page-background', '--hero-background', '--control-background', '--brand-100', '--coral-100', '--amber-100', '--danger-soft', '--warning-soft']) {
      for (const foreground of ['--ink-500', '--ink-600', '--ink-700']) {
        assert.ok(contrast(`var(${foreground})`, `var(${background})`) >= 4.5, `${foreground} must remain readable on ${background}`);
      }
    }
    assert.equal(declaration('input::placeholder', 'color'), 'var(--ink-500)');
    assert.equal(declaration('input::placeholder', 'opacity'), '1');
    assert.equal(declaration('textarea::placeholder', 'color'), 'var(--ink-500)');
  });
  it('keeps input and search boundaries above 3:1 against their adjacent neutral surfaces', () => {
    for (const selector of ['input', 'textarea', 'select', '.hero-search', '.search-field']) {
      const border = declaration(selector, 'border-color');
      for (const surface of ['--surface', '--surface-soft', '--page-background', '--hero-background', '--control-background']) {
        assert.ok(contrast(border, `var(${surface})`) >= 3, `${selector} boundary must be distinguishable on ${surface}`);
      }
    }
    assert.equal(declaration('.search-field input', 'background'), 'transparent');
    assert.equal(declaration('.hero-search input', 'box-shadow'), 'none');
  });
  it('uses an opaque brand focus indicator and gives borderless search inputs a wrapper indicator', () => {
    for (const selector of [':focus-visible', 'input:focus', 'textarea:focus', 'select:focus', '.hero-search:focus-within', '.search-field:focus-within']) {
      const outline = declaration(selector, 'outline');
      assert.match(outline, /(?:2|3)px solid var\(--control-focus\)/);
      for (const surface of ['--surface', '--page-background', '--hero-background', '--control-background']) assert.ok(contrast('var(--control-focus)', `var(${surface})`) >= 3);
    }
  });
  it('retains the requested neutral blue and the established readable type scale', () => {
    assert.equal(variables.get('--page-background'), '#eaf1f6');
    assert.equal(variables.get('--hero-background'), '#dce9f1');
    assert.equal(declaration('.hero-section', 'background'), 'var(--hero-background)');
    assert.ok(contrast('var(--hero-background)', 'var(--page-background)') > 1);
    assert.ok(contrast('var(--hero-background)', 'var(--page-background)') < 1.1);
    assert.equal(declaration('.section-mint', 'background'), 'var(--page-background)');
    assert.equal(declaration('.home-providers', 'background'), 'var(--page-background)');
    assert.ok(parseFloat(variables.get('--type-meta')!) * 16 >= 13);
    assert.ok(parseFloat(variables.get('--type-ui')!) * 16 >= 14);
    assert.ok(parseFloat(variables.get('--type-body')!) * 16 >= 16);
  });
  it('uses a light keyboard focus indicator on dark hero and authentication surfaces', () => {
    for (const selector of ['.section-dark :focus-visible', '.hero-banner :focus-visible', '.login-brand-panel :focus-visible', '.register-brand-panel :focus-visible']) {
      assert.equal(declaration(selector, 'outline-color'), 'var(--control-focus-on-dark)');
      for (const surface of ['--brand-900', '--brand-800', '--brand-700']) assert.ok(contrast('var(--control-focus-on-dark)', `var(${surface})`) >= 3);
    }
  });
  it('places two raised hero cards around a slimmer strip with four balanced service links', () => {
    assert.match(declaration('.desktop-hero-lower', 'grid-template-columns'), /minmax\(0, 1fr\)/);
    assert.equal(declaration('.desktop-hero-lower', 'margin-top'), '.75rem');
    assert.equal(declaration('.desktop-hero-lower', 'min-height'), '5.5rem');
    assert.equal(declaration('.desktop-hero-lower', 'padding'), '.25rem .4rem');
    assert.equal(declaration('.desktop-service-links', 'grid-template-columns'), 'repeat(4, minmax(0, 1fr))');
    assert.equal(declaration('.desktop-service-strip', 'border'), '0');
    assert.equal(declaration('.desktop-service-strip a', 'min-height'), '2.5rem');
    assert.equal(declaration('.desktop-service-strip a', 'font-weight'), '750');
    assert.equal(declaration('.desktop-promo-card', 'position'), 'absolute');
    assert.equal(declaration('.desktop-booking-preview', 'position'), 'absolute');
    assert.equal(declaration('.desktop-promo-card', 'bottom'), '-4.1rem');
    assert.equal(declaration('.desktop-booking-preview', 'bottom'), '-4.1rem');
    assert.equal(declaration('.desktop-promo-card > div', 'background'), 'var(--brand-800)');
    assert.equal(declaration('.desktop-booking-preview .btn', 'min-height'), '2.2rem');
    assert.equal(declaration('.desktop-hero-tag', 'font-size'), '.7rem');
    assert.equal(declaration('.desktop-hero-tag', 'background'), 'rgba(255,255,255,.84)');
    assert.equal(declaration('.desktop-service-strip a:hover', 'background'), 'var(--brand-100)');
    assert.equal(declaration('.desktop-service-strip a:focus-visible', 'box-shadow'), 'inset 0 0 0 1px var(--brand-200)');
  });
  it('gives the desktop professional feed its own accessible scroll area', () => {
    assert.equal(declaration('cvp-provider-detail .detail-main', 'overflow-y'), 'auto');
    assert.equal(declaration('cvp-provider-detail .detail-main', 'overscroll-behavior-y'), 'contain');
    assert.equal(declaration('cvp-provider-detail .detail-main', 'scrollbar-gutter'), 'stable');
    assert.equal(declaration('cvp-provider-detail .detail-main', 'scrollbar-color'), 'var(--brand-400) var(--surface-soft)');
    assert.equal(declaration('cvp-provider-detail .detail-main', 'height'), '0');
    assert.equal(declaration('cvp-provider-detail .detail-main', 'min-height'), '100%');
    assert.equal(declaration('cvp-provider-detail .detail-main', 'max-height'), 'none');
    assert.equal(declaration('cvp-provider-detail .profile-detail-layout', 'align-items'), 'stretch');
    const template = readFileSync(new URL('../src/app/features/public/pages/provider-detail/provider-detail.component.ts', import.meta.url), 'utf8');
    assert.match(template, /class="detail-main" role="region" aria-label="Perfil profissional" tabindex="0"/);
  });
  it('makes review dividers visible and gives the verified-review note the full card width', () => {
    assert.equal(declaration('cvp-provider-detail .feedback-section .review-list article', 'border-top-color'), 'var(--ink-300)');
    assert.equal(declaration('cvp-provider-detail .feedback-section > .feedback-intro', 'max-width'), 'none');
    const template = readFileSync(new URL('../src/app/features/public/pages/provider-detail/provider-detail.component.ts', import.meta.url), 'utf8');
    assert.match(template, /<\/div><p class="feedback-intro">Somente clientes que fecharam negócio pela plataforma podem avaliar com estrelas\.<\/p>/);
  });
  it('harmonizes portrait decorations with brand tones while retaining the neutral blue page', () => {
    assert.equal(declaration('.desktop-hero-visual::before', 'background'), 'linear-gradient(145deg, var(--brand-600), var(--brand-700))');
    assert.equal(declaration('.desktop-hero-visual::after', 'background'), 'var(--brand-400)');
    assert.equal(declaration('.desktop-hero-orb', 'border-color'), 'var(--brand-200)');
    assert.equal(declaration('.desktop-hero-orb.orb-mint', 'background'), 'var(--brand-700)');
    assert.equal(declaration('.desktop-hero-orb.orb-coral', 'background'), 'var(--brand-200)');
    assert.equal(variables.get('--page-background'), '#eaf1f6');
  });
  it('uses reading-size professional benefits and a larger invitation button without a fixed card height', () => {
    assert.equal(declaration('.provider-cta-actions', 'font-size'), '1rem');
    assert.equal(declaration('body .provider-cta-actions .btn', 'font-size'), '1rem !important');
    assert.equal(declaration('.provider-cta-actions .btn', 'min-height'), '3rem');
    assert.equal(declaration('.provider-cta-actions', 'gap'), '.75rem');
    assert.equal(declaration('.provider-cta', 'min-height'), '12rem');
    assert.equal(declaration('.provider-cta', 'grid-template-columns'), 'minmax(0, 1.6fr) minmax(18rem, .8fr)');
    assert.ok(!rules.some(rule => rule.selectors.includes('.provider-cta') && /(?:^|;)\s*height\s*:/.test(rule.declarations)));
    assert.ok(!rules.some(rule => rule.selectors.includes('.provider-cta') && /overflow:\s*hidden/.test(rule.declarations)));
  });
  it('keeps the catalog search header prominent and responsive', () => {
    assert.ok(
      rules.some(
        (rule) =>
          rule.selectors.includes('.page-hero.catalog-hero') &&
          rule.declarations.includes('padding-block: clamp(2rem, 3.2vw, 2.75rem)'),
      ),
    );
    assert.equal(declaration('.catalog-hero h1', 'font-size'), 'clamp(1.9rem, 5vw, 2.4rem)');
    assert.equal(declaration('body .catalog-hero p', 'font-size'), '1rem !important');
    assert.equal(declaration('.catalog-hero .search-field', 'min-height'), '3.1rem');
    assert.equal(declaration('.catalog-hero .search-field input', 'font-size'), '1rem !important');
    assert.ok(source.includes('.page-hero.catalog-hero { padding-block: 2.1rem 2.35rem; }'));
    assert.ok(source.includes('.page-hero.catalog-hero { padding-block: 1.9rem 2.1rem; }'));
  });
  it('shows home categories as a compact rail of dimensional icons and labels', () => {
    assert.equal(declaration('.home-categories .category-grid', 'grid-template-columns'), 'repeat(auto-fit, minmax(6.5rem, 1fr))');
    assert.equal(declaration('.home-categories .category-grid', 'background'), 'rgba(255, 255, 255, .88)');
    assert.equal(declaration('.home-categories .category-card', 'background'), 'transparent');
    assert.equal(declaration('.home-categories .category-card::after', 'display'), 'none');
    assert.equal(declaration('.home-categories .category-card .category-symbol', 'width'), '3.2rem');
    assert.equal(declaration('.home-categories .category-card .category-symbol', 'color'), '#fff !important');
    assert.equal(declaration('.home-categories .category-card .category-symbol', 'background'), 'linear-gradient(145deg, var(--brand-600), var(--brand-800)) !important');
    assert.equal(declaration('.home-categories .service-icon', 'width'), '1.5rem');
    assert.equal(declaration('body .home-categories .category-card strong', 'overflow-wrap'), 'anywhere');
    const template = readFileSync(new URL('../src/app/features/public/pages/home/home.component.ts', import.meta.url), 'utf8');
    assert.match(template, /class="category-symbol" aria-hidden="true"/);
    assert.ok(!template.includes('{{ category.serviceCount }}'));
  });
  it('gives catalog cards a clear visual hierarchy and distinct action', () => {
    assert.equal(declaration('.catalog-results .service-card', 'background'), 'linear-gradient(155deg, #fff 62%, var(--brand-50))');
    assert.equal(declaration('.catalog-results .service-card::before', 'height'), '.22rem');
    assert.equal(declaration('.catalog-results .service-card .card-footer', 'border-top-color'), 'var(--ink-200)');
    assert.equal(declaration('.catalog-results .service-card .text-link', 'border-radius'), '999px');
    assert.equal(declaration('.catalog-results .service-card .text-link', 'min-height'), '2.5rem');
  });
  it('organizes professional identity and booking in a compact lateral rail', () => {
    assert.equal(declaration('cvp-provider-detail .section-tight', 'padding'), '1rem 0 2rem');
    assert.equal(declaration('cvp-provider-detail .profile-detail-layout', 'width'), 'min(100% - 2rem, 68rem)');
    assert.equal(declaration('cvp-provider-detail .profile-sidebar', 'display'), 'grid');
    assert.equal(declaration('cvp-provider-detail .profile-overview-card', 'display'), 'grid');
    assert.ok(rules.some(rule => rule.selectors.includes('cvp-provider-detail .profile-intro h1') && rule.declarations.includes('font-size: clamp(1.25rem, 2vw, 1.5rem)')));
    assert.equal(declaration('body cvp-provider-detail .profile-intro p', 'font-size'), '.9375rem !important');
    assert.equal(declaration('cvp-provider-detail .profile-summary-tags', 'width'), '100%');
    assert.equal(declaration('cvp-provider-detail .profile-sidebar-facts', 'display'), 'grid');
    assert.equal(declaration('cvp-provider-detail .detail-main', 'gap'), '.85rem');
    assert.equal(declaration('cvp-provider-detail .content-card', 'padding'), '1rem');
    assert.equal(declaration('cvp-provider-detail .content-card h2', 'font-size'), '1.0625rem');
    assert.equal(declaration('cvp-provider-detail .compact-service-list', 'grid-template-columns'), 'repeat(3, minmax(0, 1fr))');
    assert.equal(declaration('cvp-provider-detail .booking-aside', 'padding'), '1rem');
    assert.equal(declaration('cvp-provider-detail .booking-aside', 'align-self'), 'start');
    assert.ok(!rules.some(rule => rule.selectors.includes('cvp-provider-detail .booking-aside') && /(?:^|;)\s*(?:height|max-height)\s*:/.test(rule.declarations)));
    assert.equal(declaration('body p', 'font-size'), '1rem !important');
  });
  it('keeps service media, profile identity and informational sections proportionate', () => {
    assert.equal(declaration('.service-detail-grid h1', 'max-width'), 'none');
    assert.ok(rules.some(rule => rule.selectors.includes('.service-visual') && rule.declarations.includes('min-height: 15rem')));
    assert.equal(declaration('.service-visual > img', 'object-fit'), 'cover');
    assert.equal(declaration('.service-detail-provider-grid .provider-card', 'padding'), '.78rem');
    assert.equal(declaration('cvp-provider-detail .profile-identity-panel', 'display'), 'grid');
    assert.ok(rules.some(rule => rule.selectors.includes('cvp-provider-detail .profile-identity-panel .avatar-lg') && rule.declarations.includes('width: 5rem')));
    assert.equal(declaration('cvp-info-page .info-page-hero', 'padding-bottom'), '.6rem');
    assert.equal(declaration('cvp-info-page .info-page-content', 'padding-top'), '.4rem');
  });
});
