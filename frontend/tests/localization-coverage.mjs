import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parseTemplate, TmplAstText, TmplAstBoundText } from '@angular/compiler';
import { replaceTranslationFragment } from '../src/app/core/localization/localized-text.util.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'src/app');
const source = ts.createSourceFile('translations.ts', readFileSync(join(app, 'core/localization/localization.service.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const entries = [];
const methods = new Map();
const patterns = [];
function readDictionary(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'TRANSLATIONS') {
    assert.ok(node.initializer && ts.isArrayLiteralExpression(node.initializer));
    for (const item of node.initializer.elements) {
      assert.ok(ts.isObjectLiteralExpression(item));
      const entry = Object.fromEntries(item.properties.map(property => {
        assert.ok(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer));
        return [property.name.getText(source), property.initializer.text];
      }));
      assert.ok(entry.pt && entry.en && entry.fr, 'Every phrase needs EN and FR');
      entries.push(entry);
    }
  }
  if (ts.isMethodDeclaration(node) && ['translate', 'translatePatterns', 'readLanguage', 'readCurrency'].includes(node.name.getText(source))) {
    methods.set(node.name.getText(source), node.getText(source));
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'replacements' && ts.isConditionalExpression(node.initializer)) {
    for (const [language, branch] of [['fr', node.initializer.whenTrue], ['en', node.initializer.whenFalse]]) {
      assert.ok(ts.isArrayLiteralExpression(branch));
      for (const pair of branch.elements) {
        assert.ok(ts.isArrayLiteralExpression(pair) && ts.isRegularExpressionLiteral(pair.elements[0]) && ts.isStringLiteral(pair.elements[1]));
        const regex = pair.elements[0].text;
        const slash = regex.lastIndexOf('/');
        patterns.push({ language, regex: new RegExp(`^(?:${regex.slice(1, slash)})$`, regex.slice(slash + 1).replace('g', '')), target: pair.elements[1].text });
      }
    }
  }
  ts.forEachChild(node, readDictionary);
}
readDictionary(source);
assert.ok(entries.length > 1000);
assert.equal(methods.size, 4);
// Exercise the actual service method bodies without Angular injection or browser storage.
// Parsing/transpiling repo code avoids copying the translation algorithm into the test.
const harnessSource = `class LocalizationHarness { constructor(chosen) { this.language = () => chosen; } ${[...methods.values()].join('\n')} }`;
const harnessJs = ts.transpileModule(harnessSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const createHarness = new Function('TRANSLATIONS', 'ORDERED_TRANSLATIONS', 'replaceTranslationFragment', 'localStorage', 'LANGUAGE_KEY', 'CURRENCY_KEY', `${harnessJs}; return LocalizationHarness;`);
const Harness = createHarness(entries, [...entries].sort((a, b) => b.pt.length - a.pt.length), replaceTranslationFragment, { getItem: key => key === 'cvp.language' ? 'pt' : 'BRL' }, 'cvp.language', 'cvp.currency');
const translators = { en: new Harness('en'), fr: new Harness('fr') };
assert.equal(translators.en.readLanguage(), 'en', 'Legacy Portuguese preferences must fall back to English');
assert.equal(translators.en.readCurrency(), 'EUR', 'Legacy BRL preferences must fall back to EUR');
const MissingStorageHarness = createHarness(entries, entries, replaceTranslationFragment, { getItem: () => { throw new Error('Storage disabled'); } }, 'cvp.language', 'cvp.currency');
assert.equal(new MissingStorageHarness('en').readLanguage(), 'en');
assert.equal(new MissingStorageHarness('en').readCurrency(), 'EUR');
for (const [language, currency] of [['en', 'EUR'], ['fr', 'USD']]) {
  const PreferenceHarness = createHarness(entries, entries, replaceTranslationFragment, { getItem: key => key === 'cvp.language' ? language : currency }, 'cvp.language', 'cvp.currency');
  assert.equal(new PreferenceHarness(language).readLanguage(), language);
  assert.equal(new PreferenceHarness(language).readCurrency(), currency);
}
for (const [phrase, english, french] of [
  ['Mostrando 1–12 de 24 profissionais', 'Showing 1–12 of 24 professionals', 'Affichage de 1 à 12 sur 24 professionnels'],
  ['Showing 1–12 of 24 professionals', 'Showing 1–12 of 24 professionals', 'Affichage de 1 à 12 sur 24 professionnels'],
  ['Mostrando 6 de 18 registros · página 1 de 3', 'Showing 6 of 18 results · page 1 of 3', 'Affichage de 6 sur 18 résultats · page 1 sur 3'],
  ['Profissionais para Limpeza', 'Professionals for Cleaning', 'Professionnels pour Ménage'],
  ['Horário de início', 'Start time', 'Heure de début'],
  ['  Valor da proposta  ', '  Proposal price  ', '  Prix de la proposition  '],
  ['Confirmar conclusão', 'Confirm completion', 'Confirmer la fin du service'],
  ['Note', 'Note', 'Observation'],
  ['Rating', 'Rating', 'Note']
]) {
  assert.equal(translators.en.translate(phrase), english);
  assert.equal(translators.fr.translate(phrase), french);
}
const dictionary = new Set(entries.flatMap(entry => [entry.pt, entry.en, entry.fr]));
// Currency/language codes, address identifiers and the brand are not translated.
const neutral = new Set(['EN', 'FR', 'EUR', 'USD', 'UTC', 'CEP', 'CPF', 'ID', 'CNPJ', 'E-mail', 'Email', 'min', 'm²', 'Pro', 'https://', 'SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'DF']);
const attributes = new Set(['aria-label', 'placeholder', 'title', 'alt', 'eyebrow', 'description', 'message', 'data-label']);
const missing = new Map();
let count = 0;
let templates = 0;
function check(value, file) {
  const phrase = value.trim().replace(/\s+/gu, ' ').replace(/^[+→✓★⌁]\s*/u, '').replace(/[\s:(]+$/u, '');
  if (!/\p{L}/u.test(phrase) || neutral.has(phrase)) return;
  count++;
  if (!dictionary.has(phrase)) {
    const locations = missing.get(phrase) ?? new Set();
    locations.add(relative(app, file).replaceAll('\\', '/'));
    missing.set(phrase, locations);
  }
}
function inspectTemplate(nodes, file, skip = false) {
  for (const node of nodes) {
    const protectedContent = skip || node.attributes?.some(attribute => attribute.name === 'data-cvp-no-localize');
    if (!protectedContent) {
      if (node instanceof TmplAstText) check(node.value, file);
      if (node instanceof TmplAstBoundText) {
        const composed = node.value.ast?.strings?.join('1') ?? '';
        const matchingPatterns = patterns.filter(pattern => pattern.regex.test(composed));
        if (matchingPatterns.length) {
          for (const language of ['en', 'fr']) {
            const pattern = matchingPatterns.find(pattern => pattern.language === language);
            assert.ok(pattern, `Dynamic phrase needs both languages: ${composed}`);
            assert.equal(translators[language].translate(composed), composed.replace(pattern.regex, pattern.target));
          }
          count++;
        } else {
          for (const fragment of node.value.ast?.strings ?? []) check(fragment, file);
        }
        for (const expression of node.value.ast?.expressions ?? []) inspectDisplayExpression(expression, file);
      }
      for (const attribute of node.attributes ?? []) if (attributes.has(attribute.name)) check(attribute.value, file);
      for (const input of node.inputs ?? []) if (attributes.has(input.name)) inspectDisplayExpression(input.value.ast, file);
    }
    for (const key of ['children', 'branches', 'cases']) {
      if (Array.isArray(node[key])) inspectTemplate(node[key], file, protectedContent);
    }
    if (node.empty) inspectTemplate(node.empty.children ?? [], file, protectedContent);
  }
}
function inspectDisplayExpression(expression, file) {
  if (!expression) return;
  if (expression.constructor.name === 'LiteralPrimitive' && typeof expression.value === 'string') check(expression.value, file);
  // Only display branches/fallbacks, never comparison keys, route parameters or date-pipe formats.
  if (expression.constructor.name === 'Conditional') {
    inspectDisplayExpression(expression.trueExp, file);
    inspectDisplayExpression(expression.falseExp, file);
  }
  if (expression.constructor.name === 'Binary' && ['||', '??'].includes(expression.operation)) {
    inspectDisplayExpression(expression.left, file);
    inspectDisplayExpression(expression.right, file);
  }
  if (expression.constructor.name === 'BindingPipe') inspectDisplayExpression(expression.exp, file);
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const interfaceProperties = new Set(['label', 'title', 'description', 'eyebrow', 'placeholder', 'message', 'hint', 'columns', 'primary', 'secondary', 'cells']);
const feedbackSignals = new Set(['error', 'actionError', 'actionSuccess', 'loadError', 'success', 'passwordError', 'emailError', 'reportError', 'commentError', 'conversationError']);
for (const file of files(app).filter(file => file.endsWith('.component.ts') || file.endsWith('.routes.ts') || file.endsWith('admin-page.config.ts') || file.endsWith('marketplace.service.ts'))) {
  const component = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function inspectSource(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(component) === 'template' && (ts.isNoSubstitutionTemplateLiteral(node.initializer) || ts.isStringLiteral(node.initializer))) {
      const parsed = parseTemplate(node.initializer.text, file);
      assert.equal(parsed.errors, null, `Template parse failed: ${file}`);
      templates++;
      inspectTemplate(parsed.nodes, file);
    }
    if (ts.isPropertyAssignment(node) && interfaceProperties.has(node.name.getText(component))) {
      if (ts.isStringLiteral(node.initializer)) check(node.initializer.text, file);
      if (ts.isArrayLiteralExpression(node.initializer)) {
        for (const value of node.initializer.elements) if (ts.isStringLiteral(value)) check(value.text, file);
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'set') {
      const receiver = node.expression.expression;
      if (ts.isPropertyAccessExpression(receiver) && feedbackSignals.has(receiver.name.text)) {
        for (const argument of node.arguments) {
          if (ts.isStringLiteral(argument)) check(argument.text, file);
          if (ts.isConditionalExpression(argument)) {
            for (const value of [argument.whenTrue, argument.whenFalse]) if (ts.isStringLiteral(value)) check(value.text, file);
          }
        }
      }
    }
    ts.forEachChild(node, inspectSource);
  }
  inspectSource(component);
}
const report = [...missing.entries()].map(([phrase, locations]) => ({ phrase, files: [...locations] }));
assert.ok(templates >= 50 && count >= 1000, 'The audit must keep covering the full interface, not silently skip it');
if (process.argv.includes('--report')) {
  const offset = Number(process.argv.find(argument => argument.startsWith('--offset='))?.split('=')[1] ?? 0);
  const limit = Number(process.argv.find(argument => argument.startsWith('--limit='))?.split('=')[1] ?? 30);
  console.log(JSON.stringify({ templates, checked: count, missingCount: report.length, missing: report.slice(offset, offset + limit) }, null, 2));
} else {
  assert.deepEqual(report, [], 'Static interface phrases need complete EN/FR translations');
  console.log(`PASS localization coverage: ${templates} templates, ${count} interface phrases, EN/FR complete.`);
}
