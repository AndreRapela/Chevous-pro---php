import assert from 'node:assert/strict';

export function assertHomeServiceCard(html) {
  const card = html.match(/<nav\b[^>]*\bclass="desktop-service-strip"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(card, 'Home must render a single service navigation card.');
  assert.match(card[0], /aria-label="Featured services"/);
  const links = [...card[1].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 5, 'The card must contain exactly five service shortcuts.');
  for (const [index, [label, query]] of [['Cleaning', 'limpeza'], ['Laundry', 'lavagem'], ['Repairs', 'reparo'], ['Painting', 'pintura'], ['Garden', 'jardim']].entries()) {
    assert.equal(links[index][1], `/servicos?q=${query}`);
    assert.ok(links[index][2].includes(label), `Missing ${label} shortcut.`);
    assert.match(links[index][2], /<svg\b/, `${label} must retain its service icon.`);
    assert.match(links[index][2], /aria-hidden="true"/, 'Decorative icons must not duplicate accessible link names.');
  }
  assert.ok(!card[1].includes('<aside'));
  assert.doesNotMatch(html, /class="desktop-(?:promo-card|booking-preview)"/, 'The hero must only show the service shortcuts below the main content.');
}
