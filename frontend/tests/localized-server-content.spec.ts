import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localizeServerContent } from '../src/app/shared/localization/localized-server-content.util.ts';

function text(data: string) { return { nodeType: 3, data, childNodes: [] }; }
function element(tagName: string, attributes: Record<string, string> = {}, children: unknown[] = []) {
  return { nodeType: 1, tagName, childNodes: children, attributes,
    hasAttribute: (name: string) => Object.hasOwn(attributes, name),
    getAttribute: (name: string) => attributes[name] ?? null,
    setAttribute: (name: string, value: string) => { attributes[name] = value; }
  };
}
function run(root: unknown) { localizeServerContent(root as Node, value => ({ Buscar: 'Search', Serviço: 'Service' })[value] ?? value); }

describe('SSR interface localization', () => {
  it('translates text and accessible attributes without replacing nodes', () => {
    const label = text('Buscar');
    const input = element('INPUT', { placeholder: 'Buscar', 'aria-label': 'Buscar', value: 'Buscar' });
    const cell = element('TD', { 'data-label': 'Serviço', title: 'Serviço', alt: 'Serviço' }, [text('Serviço')]);
    const comment = { nodeType: 8, data: 'Buscar', childNodes: [] };
    const root = element('DIV', {}, [label, input, cell, comment]);
    run(root);
    assert.equal(root.childNodes[0], label);
    assert.equal(root.childNodes[1], input);
    assert.equal(label.data, 'Search');
    assert.equal(input.attributes.placeholder, 'Search');
    assert.equal(input.attributes['aria-label'], 'Search');
    assert.equal(input.attributes.value, 'Buscar', 'User values must not be translated');
    assert.equal(cell.attributes['data-label'], 'Service');
    assert.equal(cell.attributes.title, 'Service');
    assert.equal(cell.attributes.alt, 'Service');
    assert.equal(comment.data, 'Buscar', 'Hydration comments must not be translated');
  });
  it('preserves user-content subtrees and executable/textarea content', () => {
    for (const tagName of ['SCRIPT', 'STYLE', 'TEXTAREA']) {
      const value = text('Buscar');
      run(element(tagName, {}, [value]));
      assert.equal(value.data, 'Buscar');
    }
    const name = text('Buscar');
    const privateContent = element('DIV', { 'data-cvp-no-localize': '', title: 'Buscar' }, [element('SPAN', {}, [name])]);
    run(privateContent);
    assert.equal(name.data, 'Buscar');
    assert.equal(privateContent.attributes.title, 'Buscar');
    const value = text('Buscar');
    const textarea = element('TEXTAREA', { placeholder: 'Buscar' }, [value]);
    run(textarea);
    assert.equal(textarea.attributes.placeholder, 'Search');
    assert.equal(value.data, 'Buscar');
  });
  it('leaves already localized text and attributes unchanged', () => {
    const label = text('Search');
    const root = element('DIV', { title: 'Search' }, [label, text('')]);
    run(root);
    assert.equal(label.data, 'Search');
    assert.equal(root.attributes.title, 'Search');
  });
});
