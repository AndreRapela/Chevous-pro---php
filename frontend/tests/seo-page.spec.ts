import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { providerPublicPath } from '../src/app/shared/utils/public-url.util.ts';
import type { ProviderProfile } from '../src/app/core/models/index.ts';

// Execute repository-owned methods with metadata doubles, not browser automation.
function compileMethods(path: string, names: string[], dependencies: Record<string, unknown> = {}) {
  const source = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const methods: string[] = [];
  function inspect(node: ts.Node): void {
    if (ts.isMethodDeclaration(node) && names.includes(node.name.getText(source))) methods.push(node.getText(source));
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  assert.equal(methods.length, names.length);
  const output = ts.transpileModule(`class Harness { ${methods.join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `${output}; return Harness;`)(...Object.values(dependencies));
}

const Harness = compileMethods('../src/app/core/seo/seo.service.ts', ['update', 'updateRoute', 'render', 'setName', 'setProperty', 'setCanonical', 'setStructuredData', 'absoluteUrl', 'structuredDataValue', 'clean'], { DEFAULT_IMAGE_PATH: '/images/profissional-limpeza-hero-warm-887.jpg' });
const AppHarness = compileMethods('../src/app/app.component.ts', ['applyStaticRouteSeo'], { DEFAULT_SEO: { title: 'Pro | Home services', description: 'Find trusted professionals for your home.', canonicalPath: '/' } });

class MetadataNode {
  id = '';
  rel = '';
  href = '';
  textContent = '';
  attributes = new Map<string, string>();
  private readonly removeNode: (node: MetadataNode) => void;
  constructor(removeNode: (node: MetadataNode) => void) { this.removeNode = removeNode; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  remove(): void { this.removeNode(this); }
}

function fixture(url = '/servicos/categoria/cleaning') {
  const harness = new Harness();
  const tags = new Map<string, string>();
  let nodes: MetadataNode[] = [];
  let title = '';
  let language = 'en';
  const translations: Record<string, string> = {
    'Home services | Pro': 'Services à domicile | Pro',
    'Cleaning': 'Ménage',
    'Home cleaning.': 'Ménage à domicile.',
    'Compare opções e solicite um horário com profissionais aprovados.': 'Comparez les options et demandez un créneau avec des professionnels approuvés.',
    'Encontre serviços para casa, compare opções e solicite um horário com profissionais aprovados.': 'Trouvez des services à domicile et comparez les options.',
    'Veja experiência, serviços e avaliações de reservas.': 'Consultez l’expérience, les services et les avis des réservations.',
    'Início': 'Accueil',
    'Profissionais': 'Professionnels',
    'Casa': 'Domicile'
  };
  harness.router = { url };
  harness.siteOrigin = 'https://chezvoust.test';
  harness.localization = { language: () => language, translate: (text: string) => language === 'fr' ? (translations[text] ?? text.replaceAll('Casa', 'Domicile')) : text };
  harness.document = {
    location: { pathname: url.split('?')[0] },
    head: { querySelector: () => nodes.find(node => node.rel === 'canonical') ?? null, appendChild: (node: MetadataNode) => nodes.push(node) },
    createElement: () => new MetadataNode(node => { nodes = nodes.filter(item => item !== node); }),
    getElementById: (id: string) => nodes.find(node => node.id === id) ?? null
  };
  harness.meta = { updateTag: (tag: { name?: string; property?: string; content: string }) => tags.set(`${tag.name ? 'name' : 'property'}:${tag.name ?? tag.property}`, tag.content), removeTag: (selector: string) => { const match = selector.match(/^(name|property)="([^"]+)"$/); if (match) tags.delete(`${match[1]}:${match[2]}`); } };
  harness.title = { setTitle: (value: string) => { title = value; } };
  return {
    harness, tags, title: () => title,
    canonical: () => nodes.find(node => node.rel === 'canonical')?.href,
    structured: () => { const text = nodes.find(node => node.id === 'chezvoust-structured-data')?.textContent; return text ? JSON.parse(text) : null; },
    changeLanguage: (value: string) => { language = value; }
  };
}

describe('page metadata ownership', () => {
  it('keeps dynamic canonical URLs and structured data after a queued route-default update', () => {
    const view = fixture();
    view.harness.update({ title: 'Cleaning | Pro', description: 'Home cleaning.', canonicalPath: '/servicos/categoria/cleaning', structuredData: { '@type': 'CollectionPage', url: '/servicos/categoria/cleaning' } });
    const app = new AppHarness();
    app.localization = view.harness.localization;
    app.seo = view.harness;
    app.router = { routerState: { snapshot: { root: { data: { seo: { title: 'Home services | Pro', description: 'Generic catalog.', canonicalPath: '/servicos' } }, routeConfig: {}, firstChild: null } } } };
    app.applyStaticRouteSeo();
    assert.equal(view.title(), 'Cleaning | Pro');
    assert.equal(view.canonical(), 'https://chezvoust.test/servicos/categoria/cleaning');
    assert.deepEqual(view.structured(), { '@type': 'CollectionPage', url: 'https://chezvoust.test/servicos/categoria/cleaning' });
  });
  it('preserves search noindex and clears old page data after a different route or query', () => {
    const view = fixture('/servicos?q=cleaning');
    view.harness.update({ title: 'Search', description: 'Filtered catalog.', noindex: true, structuredData: { '@type': 'CollectionPage' } });
    view.harness.updateRoute({ title: 'Catalog', description: 'Generic.' });
    assert.equal(view.tags.get('name:robots'), 'noindex, nofollow');
    view.harness.router.url = '/servicos';
    view.harness.updateRoute({ title: 'Home services | Pro', description: 'Unfiltered catalog.', canonicalPath: '/servicos' });
    assert.equal(view.tags.get('name:robots'), 'index, follow, max-image-preview:large');
    assert.equal(view.structured(), null);
    view.harness.router.url = '/entrar';
    view.harness.updateRoute({ title: 'Sign in', description: 'Your account.', canonicalPath: '/entrar', noindex: true, imagePath: '' });
    assert.equal(view.title(), 'Sign in');
    assert.equal(view.tags.get('name:robots'), 'noindex, nofollow');
    assert.equal(view.canonical(), 'https://chezvoust.test/entrar');
    assert.equal(view.tags.has('property:og:image'), false);
    assert.equal(view.tags.has('name:twitter:image'), false);
  });
  it('refreshes EN/FR metadata without discarding the page-owned structured data', () => {
    const view = fixture('/');
    view.harness.update({ title: 'Home services | Pro', description: 'Home cleaning.', canonicalPath: '/', structuredData: { '@type': 'WebSite', name: 'ChezVoust Pro' } });
    view.changeLanguage('fr');
    view.harness.updateRoute({ title: 'Generic', description: 'Generic.' });
    assert.equal(view.title(), 'Services à domicile | Pro');
    assert.equal(view.tags.get('property:og:locale'), 'fr_FR');
    assert.equal(view.tags.get('name:description'), 'Ménage à domicile.');
    assert.equal(view.structured().name, 'ChezVoust Pro');
    view.changeLanguage('en');
    view.harness.updateRoute({ title: 'Generic', description: 'Generic.' });
    assert.equal(view.title(), 'Home services | Pro');
    assert.equal(view.tags.get('property:og:locale'), 'en_US');
  });
  it('keeps already-composed personal content untranslated and safely escapes JSON-LD', () => {
    const view = fixture();
    view.changeLanguage('fr');
    const personal = 'Casa </script><script>not executable</script>';
    view.harness.update({ title: 'Casa', description: personal, translateContent: false, structuredData: { '@type': 'Person', name: personal, url: '/profissionais/person', image: 'https://images.test/photo.jpg' } });
    assert.equal(view.title(), 'Casa');
    assert.equal(view.tags.get('name:description'), personal);
    assert.equal(view.structured().name, personal);
    assert.equal(view.structured().url, 'https://chezvoust.test/profissionais/person');
    assert.equal(view.structured().image, 'https://images.test/photo.jpg');
    const script = view.harness.document.getElementById('chezvoust-structured-data');
    assert.ok(!script.textContent.includes('<'));
  });
});

describe('dynamic page content metadata', () => {
  it('localizes both category and unfiltered catalog titles before marking them composed', () => {
    const Harness = compileMethods('../src/app/features/public/pages/catalog/catalog.component.ts', ['updateSeo']);
    const page = new Harness();
    const view = fixture();
    view.changeLanguage('fr');
    page.localization = view.harness.localization;
    page.seo = view.harness;
    page.categories = () => [{ slug: 'cleaning', name: 'Cleaning', description: 'Home cleaning.' }];
    page.categorySlug = () => 'cleaning';
    page.query = () => '';
    page.updateSeo();
    assert.equal(view.title(), 'Ménage | Pro');
    assert.equal(view.structured().name, 'Ménage');
    page.categorySlug = () => '';
    page.updateSeo();
    assert.equal(view.title(), 'Services à domicile | Pro');
    assert.equal(view.structured().name, 'Services à domicile');
  });
  it('preserves professional names, biographies and review bodies in their original form', () => {
    const Harness = compileMethods('../src/app/features/public/pages/provider-detail/provider-detail.component.ts', ['updateSeo'], { providerPublicPath });
    const page = new Harness();
    const view = fixture('/profissionais/person/casa');
    view.changeLanguage('fr');
    page.localization = view.harness.localization;
    page.seo = view.harness;
    const person = { id: 'person', name: 'Casa', headline: 'Casa repairs', bio: 'Casa biography', city: 'Casa City', qualities: [], reviewCount: 1, rating: 5 } as unknown as ProviderProfile;
    page.updateSeo(person, [{ author: 'Casa Author', rating: 5, comment: 'Casa original review.', createdAt: '2026-09-18' }]);
    assert.equal(view.title(), 'Casa | Casa repairs | Pro');
    assert.equal(view.tags.get('name:description'), 'Casa biography');
    assert.equal(view.structured()[0].name, 'Casa');
    assert.equal(view.structured()[0].review[0].reviewBody, 'Casa original review.');
    assert.equal(view.structured()[0].review[0].author.name, 'Casa Author');
    page.updateSeo({ ...person, bio: '', reviewCount: 0 }, []);
    assert.ok(view.tags.get('name:description')?.startsWith('Casa · Casa City.'));
    assert.equal(view.structured()[0].review, undefined);
    view.harness.updateRoute({ title: 'Generic profile', description: 'Generic.' });
    assert.equal(view.tags.get('property:og:type'), 'profile');
    assert.equal(view.structured()[0].name, 'Casa');
  });
});
