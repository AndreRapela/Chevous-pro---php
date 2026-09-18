import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Palette/selector regressions, not a substitute for browser or full WCAG auditing.
const source = readFileSync(new URL('../src/styles.scss', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
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
    for (const background of ['--surface', '--surface-soft', '--page-background', '--control-background', '--brand-100', '--coral-100', '--amber-100', '--danger-soft', '--warning-soft']) {
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
      for (const surface of ['--surface', '--surface-soft', '--page-background', '--control-background']) {
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
      for (const surface of ['--surface', '--page-background', '--control-background']) assert.ok(contrast('var(--control-focus)', `var(${surface})`) >= 3);
    }
  });
  it('retains the requested neutral blue and the established readable type scale', () => {
    assert.equal(variables.get('--page-background'), '#eaf1f6');
    assert.equal(declaration('.section-mint', 'background'), 'var(--page-background)');
    assert.equal(declaration('.home-providers', 'background'), 'var(--page-background)');
    assert.ok(parseFloat(variables.get('--type-meta')!) * 16 >= 13);
    assert.ok(parseFloat(variables.get('--type-ui')!) * 16 >= 14);
    assert.ok(parseFloat(variables.get('--type-body')!) * 16 >= 16);
  });
  it('uses a light keyboard focus indicator on dark hero and authentication surfaces', () => {
    for (const selector of ['.section-dark :focus-visible', '.hero-banner :focus-visible', '.desktop-promo-card:focus-visible', '.login-brand-panel :focus-visible', '.register-brand-panel :focus-visible']) {
      assert.equal(declaration(selector, 'outline-color'), 'var(--control-focus-on-dark)');
      for (const surface of ['--brand-900', '--brand-800', '--brand-700']) assert.ok(contrast('var(--control-focus-on-dark)', `var(${surface})`) >= 3);
    }
  });
});
