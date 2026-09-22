import assert from 'node:assert/strict';

export function assertHomeServiceCard(html) {
  const card = html.match(/<nav\b[^>]*\bclass="desktop-service-strip"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(card, 'Home must render a single service navigation card.');
  assert.match(card[0], /aria-label="Featured services"/);
  const links = [...card[1].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 4, 'The card must contain exactly four service shortcuts.');
  for (const [index, [label, query]] of [['Cleaning', 'limpeza'], ['Laundry', 'lavagem'], ['Repairs', 'reparo'], ['Painting', 'pintura']].entries()) {
    assert.equal(links[index][1], `/servicos?q=${query}`);
    assert.ok(links[index][2].includes(label), `Missing ${label} shortcut.`);
    assert.match(links[index][2], /<svg\b/, `${label} must retain its service icon.`);
    assert.match(links[index][2], /aria-hidden="true"/, 'Decorative icons must not duplicate accessible link names.');
  }
  assert.ok(!card[1].includes('<aside'));
  assert.ok(html.includes('desktop-promo-card'), 'The confidence card must be restored to the desktop hero.');
  assert.ok(html.includes('desktop-booking-preview'), 'The compact booking preview must be restored to the desktop hero.');
  assert.ok(html.includes('Reviewed and approved profiles'), 'The confidence card must be localized and readable.');
  assert.ok(html.includes('Ana Clara'), 'The booking preview must retain the featured professional.');
}
