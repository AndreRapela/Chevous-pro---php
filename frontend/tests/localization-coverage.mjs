import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parseTemplate, TmplAstText, TmplAstBoundText } from '@angular/compiler';
import { replaceTranslationFragment } from '../src/app/core/localization/localized-text.util.ts';
import * as english from '../src/app/core/localization/translations.en.ts';
import * as french from '../src/app/core/localization/translations.fr.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'src/app');
const source = ts.createSourceFile('translations.ts', readFileSync(join(app, 'core/localization/localization.service.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
assert.equal(english.translations.length, french.translations.length);
const entries = english.translations.map(([pt, en], index) => {
  const [frenchSource, fr] = french.translations[index];
  assert.equal(frenchSource, pt, 'French phrases must follow the English source order');
  assert.ok(pt && en && fr, 'Every phrase needs EN and FR');
  return { pt, en, fr };
});
const methods = new Map();
const patterns = [['en', english], ['fr', french]].flatMap(([language, catalog]) =>
  catalog.patterns.map(([regex, target]) => ({
    language, regex: new RegExp(`^(?:${regex.source})$`, regex.flags.replace('g', '')), target
  })));
function readPreferences(node) {
  if (ts.isMethodDeclaration(node) && ['readLanguage', 'readCurrency'].includes(node.name.getText(source))) {
    methods.set(node.name.getText(source), node.getText(source));
  }
  ts.forEachChild(node, readPreferences);
}
readPreferences(source);
assert.ok(entries.length > 1000);
assert.equal(methods.size, 2);
// Exercise the app catalog and preference methods without Angular or browser storage.
const catalogSource = readFileSync(join(app, 'core/localization/translation-catalog.ts'), 'utf8')
  .replace(/^import .*;\r?\n/, '').replace('export function', 'function');
const catalogJs = ts.transpileModule(catalogSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const createCatalog = new Function('replaceTranslationFragment', `${catalogJs}; return createTranslationCatalog;`)(replaceTranslationFragment);
const translators = {
  en: { translate: createCatalog(english.translations, english.patterns) },
  fr: { translate: createCatalog(english.translations, french.patterns, french.translations, true) }
};
const harnessSource = `class LocalizationHarness { ${[...methods.values()].join('\n')} }`;
const harnessJs = ts.transpileModule(harnessSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const createHarness = new Function('localStorage', 'LANGUAGE_KEY', 'CURRENCY_KEY', `${harnessJs}; return new LocalizationHarness();`);
const legacy = createHarness({ getItem: key => key === 'cvp.language' ? 'pt' : 'BRL' }, 'cvp.language', 'cvp.currency');
assert.equal(legacy.readLanguage(), 'en', 'Legacy Portuguese preferences must fall back to English');
assert.equal(legacy.readCurrency(), 'EUR', 'Legacy BRL preferences must fall back to EUR');
const missingStorage = createHarness({ getItem: () => { throw new Error('Storage disabled'); } }, 'cvp.language', 'cvp.currency');
assert.equal(missingStorage.readLanguage(), 'en');
assert.equal(missingStorage.readCurrency(), 'EUR');
for (const [language, currency] of [['en', 'EUR'], ['fr', 'USD']]) {
  const preferences = createHarness({ getItem: key => key === 'cvp.language' ? language : currency }, 'cvp.language', 'cvp.currency');
  assert.equal(preferences.readLanguage(), language);
  assert.equal(preferences.readCurrency(), currency);
}
for (const [phrase, english, french] of [
  ['Etapa 1 de 3', 'Step 1 of 3', 'Étape 1 sur 3'],
  ['Step 3 of 3', 'Step 3 of 3', 'Étape 3 sur 3'],
  ['Etapa 2 de 4', 'Step 2 of 4', 'Étape 2 sur 4'],
  ['Mostrando 1–12 de 24 profissionais', 'Showing 1–12 of 24 professionals', 'Affichage de 1 à 12 sur 24 professionnels'],
  ['Showing 1–12 of 24 professionals', 'Showing 1–12 of 24 professionals', 'Affichage de 1 à 12 sur 24 professionnels'],
  ['Mostrando 6 de 18 registros · página 1 de 3', 'Showing 6 of 18 results · page 1 of 3', 'Affichage de 6 sur 18 résultats · page 1 sur 3'],
  ['Profissionais para Limpeza', 'Professionals for Cleaning', 'Professionnels pour Ménage'],
  ['Horário de início', 'Start time', 'Heure de début'],
  ['  Valor da proposta  ', '  Proposal price  ', '  Prix de la proposition  '],
  ['Confirmar conclusão', 'Confirm completion', 'Confirmer la fin du service'],
  ['Note', 'Note', 'Observation'],
  ['Rating', 'Rating', 'Note'],
  ['Veja experiência, serviços e avaliações de reservas.', 'View experience, services and booking reviews.', 'Consultez l’expérience, les services et les avis des réservations.'],
  ['Produtos para cuidar melhor da sua casa', 'Products to take better care of your home', 'Des produits pour mieux prendre soin de votre maison'],
  ['Novidades na loja', 'New in store', 'Nouveautés en boutique'],
  ['Preços e disponibilidade podem mudar sem aviso prévio.', 'Prices and availability are subject to change without notice.', 'Les prix et la disponibilité peuvent changer sans préavis.'],
  ['Kit de lavanderia essencial', 'Essential laundry kit', 'Kit de lessive essentiel'],
  ['Ver produto', 'View product', 'Voir le produit'],
  ['E-mail ou senha incorretos.', 'Incorrect email or password.', 'Adresse e-mail ou mot de passe incorrect.'],
  ['Muitas tentativas. Tente novamente em 30 segundos.', 'Too many attempts. Try again in 30 seconds.', 'Trop de tentatives. Réessayez dans 30 secondes.'],
  ['O valor mínimo é 3.', 'The minimum value is 3.', 'La valeur minimale est de 3.'],
  ['Uma seleção versátil para a manutenção semanal dos ambientes.', 'A versatile selection for weekly home cleaning.', 'Une sélection polyvalente pour l’entretien hebdomadaire de la maison.']
]) {
  assert.equal(translators.en.translate(phrase), english);
  assert.equal(translators.fr.translate(phrase), french);
}
for (const [source, en, fr] of [
  ['BLACK FRIDAY OFFER', 'Black Friday offer', 'Offre Black Friday'],
  ['Ver produto', 'View product', 'Voir le produit'],
  ['Oferta do produto Casa Nova', 'Oferta do produto Casa Nova', 'Oferta do produto Casa Nova'],
]) {
  assert.equal(translators.en.translate(source, true), en);
  assert.equal(translators.fr.translate(source, true), fr);
}
const dictionary = new Set(entries.flatMap(entry => [entry.pt, entry.en, entry.fr]));
// Currency/language codes, address identifiers and the brand are not translated.
const neutral = new Set(['EN', 'FR', 'EUR', 'USD', 'UTC', 'CEP', 'CPF', 'ID', 'CNPJ', 'E-mail', 'Email', 'min', 'm²', 'Pro', 'https://', 'SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'DF']);
const attributes = new Set(['aria-label', 'placeholder', 'title', 'alt', 'eyebrow', 'description', 'message', 'data-label', 'heroTitle', 'heroDescription', 'imageAlt']);
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
        const composed = (node.value.ast?.strings?.join('1') ?? '').trim();
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
  if (expression.constructor.name === 'ParenthesizedExpression') inspectDisplayExpression(expression.expression, file);
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
// API errors and success messages shown by screens are also interface text.
const backend = join(root, '../backend');
if (existsSync(backend)) {
  for (const file of [...files(join(backend, 'src')), ...files(join(backend, 'public'))].filter(file => file.endsWith('.php'))) {
    const contents = readFileSync(file, 'utf8');
    for (const pattern of [
      /new ApiException\(\s*\d+,\s*'[^']+',\s*'([^'\n]+)'/g,
      /['"]message['"]\s*=>\s*'([^'\n]+)'/g,
      /(?:queryRow|requireRow)\([^;]+,\s*'([^'\n]+[.!])'\)/g,
    ]) {
      for (const [, phrase] of contents.matchAll(pattern)) check(phrase, file);
    }
    if (file.endsWith('Validator.php')) {
      for (const [, phrase] of contents.matchAll(/(?:=>|\[\]\s*=)\s*'([^'\n]+\.)'/g)) check(phrase, file);
    }
  }
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
    if (ts.isPropertyAssignment(node) && node.name.getText(component) === 'templateUrl' && ts.isStringLiteral(node.initializer)) {
      const templateFile = join(dirname(file), node.initializer.text);
      const parsed = parseTemplate(readFileSync(templateFile, 'utf8'), templateFile);
      assert.equal(parsed.errors, null, `Template parse failed: ${templateFile}`);
      templates++;
      inspectTemplate(parsed.nodes, templateFile);
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
          inspectFeedback(argument, file);
        }
      }
    }
    ts.forEachChild(node, inspectSource);
  }
  inspectSource(component);
}
function inspectFeedback(expression, file) {
  if (ts.isStringLiteral(expression)) check(expression.text, file);
  if (ts.isConditionalExpression(expression)) {
    inspectFeedback(expression.whenTrue, file);
    inspectFeedback(expression.whenFalse, file);
  }
  if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
    inspectFeedback(expression.left, file);
    inspectFeedback(expression.right, file);
  }
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
