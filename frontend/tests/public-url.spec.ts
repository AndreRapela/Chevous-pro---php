import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { categoryPublicPath, providerPublicPath, slugifyPublicText } from '../src/app/shared/utils/public-url.util.ts';

describe('public SEO URLs', () => {
  it('cria slugs estáveis, legíveis e seguros para perfis públicos', () => {
    assert.equal(slugifyPublicText('  Márcia D’Ávila — São Paulo! '), 'marcia-d-avila-sao-paulo');
    assert.equal(slugifyPublicText('***'), 'profissional');
    assert.deepEqual(
      providerPublicPath({ id: 'prof-123', name: 'Márcia D’Ávila', city: 'São Paulo' }),
      ['/profissionais', 'prof-123', 'marcia-d-avila-sao-paulo']
    );
  });

  it('mantém a categoria em uma rota rastreável, sem depender de query string', () => {
    assert.deepEqual(categoryPublicPath({ slug: 'limpeza-residencial' }), ['/servicos', 'categoria', 'limpeza-residencial']);
  });
});
