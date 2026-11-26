import { once } from 'node:events';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import express from 'express';

const build = fileURLToPath(new URL('../dist/chezvoust-pro/browser/', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));
const pageShell = resolve(build, 'index.csr.html');
const fixtureUrl = (length) => `/fixtures/campaign-${length}.webm`;
const fixtureFile = (length) => resolve(fixtures, `campaign-${length}.webm`);
const adminSession = {
  user: { id: 'fixture-admin', email: 'admin@example.invalid', name: 'Fixture Admin', role: 'admin' },
  accessToken: 'browser-fixture',
};
let server;
let origin;

test.use({ locale: 'en-US', channel: process.env.CVP_BROWSER_CHANNEL || undefined });

test.beforeAll(async () => {
  await access(pageShell);
  const app = express();
  app.use('/fixtures', express.static(fixtures));
  app.use(express.static(build, { index: false }));
  app.get(['/', '/entrar', '/cadastro', '/verificar-email', '/admin/conteudo', '/servicos/fixture-electrician'],
    (_request, response) => response.sendFile(pageShell));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (!server) return;
  await new Promise((done) => server.close(done));
});

async function stubApi(page, replies) {
  await page.route('**/api/v1/**', (route) => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname}`;
    if (!Object.hasOwn(replies, key)) {
      return route.fulfill({ status: 404, json: { error: { code: 'UNEXPECTED_FIXTURE_REQUEST', message: key } } });
    }
    const reply = replies[key];
    const data = typeof reply === 'function' ? reply(request) : reply;
    return route.fulfill({ json: { data } });
  });
}

test('os cartões da home abrem detalhes e perfis com clique em telas estreitas', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 860 });
  const service = { id: 'service-1', slug: 'fixture-cleaning', name: 'Fixture cleaning', categoryId: 'cleaning' };
  const professional = { id: 'provider-1', name: 'Fixture Professional', city: 'Brussels', verified: true };
  await stubApi(page, {
    'GET /api/v1/home': {
      categories: [], promotions: [],
      services: [service, { ...service, id: 'service-2', slug: 'fixture-repairs' }, { ...service, id: 'service-3', slug: 'fixture-painting' }],
      professionals: [professional, { ...professional, id: 'provider-2' }, { ...professional, id: 'provider-3' }],
    },
    'GET /api/v1/services/fixture-cleaning': service,
    'GET /api/v1/professionals': [],
    'GET /api/v1/professionals/provider-1': professional,
    'GET /api/v1/professionals/provider-1/reviews': [],
    'GET /api/v1/professionals/provider-1/comments': [],
    'GET /api/v1/services': [],
  });
  for (const [selector, linkSelector, path, heading] of [
    ['.home-popular .service-grid', 'a.service-tile-action', '/servicos/fixture-cleaning', 'Professionals for fixture cleaning'],
    ['.home-providers .provider-grid', '.card-footer a', '/profissionais/provider-1/fixture-professional-brussels', professional.name],
  ]) {
    await page.goto(origin);
    const row = page.locator(selector);
    const link = row.locator(linkSelector).first();
    await link.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
    await link.click({ trial: true });
    expect(await row.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

    const box = await link.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 80, y, { steps: 5 });
    await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await page.mouse.up();
    await expect(page).toHaveURL(`${origin}/`);

    await link.click();
    await expect(page).toHaveURL(`${origin}${path}`);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
  }
});

test('a campanha mantém título, botão e selo no idioma selecionado', async ({ page }) => {
  await stubApi(page, {
    'GET /api/v1/home': {
      services: [], categories: [], professionals: [],
      promotions: [{
        id: 'offer', active: true, title: 'Ofertas escolhidas para você', ctaUrl: '/produtos', ctaLabel: 'Ver produto',
        subtitle: 'Find useful products for cleaning, organizing, and home maintenance.', badgeText: 'BLACK FRIDAY OFFER',
        secondaryLinks: [{ label: 'Ver ofertas', url: '/produtos', placement: 'banner' }],
      }],
    },
  });
  await page.goto(origin);
  const campaign = page.locator('.home-discount-banner');
  await expect(campaign.getByRole('heading')).toHaveText('Special offers picked for you');
  await expect(campaign.locator('.home-discount-cta')).toHaveText('View product →');
  await expect(campaign.locator('.home-discount-pill')).toHaveText('Black Friday offer');

  await page.locator('cvp-locale-controls .locale-trigger:visible').first().click();
  await page.locator('cvp-locale-controls .locale-option:visible').filter({ hasText: 'FR' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  await expect(campaign.getByRole('heading')).toHaveText('Des offres sélectionnées pour vous');
  await expect(campaign.locator('.home-discount-cta')).toHaveText('Voir le produit →');
  await expect(campaign.locator('.home-discount-pill')).toHaveText('Offre Black Friday');
  await expect(campaign.locator('p')).toHaveText('Trouvez des produits utiles pour le nettoyage, le rangement et l’entretien de la maison.');
  await expect(campaign.getByRole('link', { name: 'Voir les offres' })).toBeVisible();
});

test('o serviço sem campanha abre na lista com a foto do profissional', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 860 });
  const avatarUrl = '/images/perfil-eletricista-rafael-nunes-640.jpg';
  await stubApi(page, {
    'GET /api/v1/services/fixture-electrician': { id: 'electrical', slug: 'fixture-electrician', name: 'Fixture electrician' },
    'GET /api/v1/professionals': [{ id: 'professional-1', name: 'Fixture Alex', city: 'Brussels', avatarUrl }],
  });
  await page.goto(`${origin}/servicos/fixture-electrician`);

  const list = page.locator('.service-detail-providers');
  await expect(list.getByRole('heading', { level: 1 })).toHaveText('Professionals for fixture electrician');
  await expect(page.locator('.service-detail-hero')).toHaveCount(0);
  const provider = list.locator('cvp-provider-card');
  await expect(provider.getByRole('heading', { name: 'Fixture Alex' })).toBeVisible();
  await expect(provider.locator('img')).toHaveAttribute('src', avatarUrl);
  await expect(provider.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '/profissionais/professional-1/fixture-alex-brussels');
});

test('uma campanha publicada no serviço exibe um só banner e alterna a foto e o nome juntos', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 860 });
  const artwork = '/images/promo-laundry-discount-v1.webp';
  const first = { id: 'professional-1', name: 'Fixture Alex', city: 'Brussels', avatarUrl: '/images/perfil-eletricista-rafael-nunes-640.jpg' };
  const second = { id: 'professional-2', name: 'Fixture Robin', city: 'Brussels', avatarUrl: '/images/perfil-tecnico-bruno-almeida-640.jpg' };
  const service = {
    id: 'electrical', slug: 'fixture-electrician', name: 'Fixture electrician', categoryId: 'repairs',
    promotions: [
      { id: 'first', title: 'Priority slots', subtitle: 'Book a visit this week.', imageUrl: artwork },
      { id: 'second', title: 'Evening visits', ctaLabel: 'Ver ofertas', ctaUrl: '/ajuda' },
    ],
  };
  await stubApi(page, {
    'GET /api/v1/services/fixture-electrician': service,
    'GET /api/v1/professionals': [first, second],
  });
  const start = new Date('2026-11-26T14:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 500));
  await page.goto(`${origin}/servicos/fixture-electrician`);

  const banner = page.locator('.service-detail-hero article');
  await expect.poll(async () => {
    await page.clock.runFor(20);
    return (await banner.locator('.service-banner-title').allTextContents())[0];
  }).toBe('Priority slots');
  await expect(banner).toHaveCount(1);
  await expect(banner.getByRole('heading', { level: 1 })).toHaveText(service.name);
  await expect(banner.locator('.service-banner-media img')).toHaveAttribute('src', artwork);
  const profile = banner.locator('.service-banner-profile');
  await expect(profile).toContainText(first.name);
  await expect(profile.locator('img')).toHaveAttribute('src', first.avatarUrl);
  const copy = await banner.locator('.service-detail-copy').boundingBox();
  const portrait = await profile.locator('img').boundingBox();
  expect(portrait.x).toBeGreaterThan(copy.x + copy.width);
  expect((await banner.boundingBox()).height).toBeLessThan(310);

  await page.clock.fastForward(60_200);
  await page.clock.runFor(100);
  await expect(banner.locator('.service-banner-title')).toHaveText('Evening visits');
  await expect(profile).toContainText(second.name);
  await expect(profile.locator('img')).toHaveAttribute('src', second.avatarUrl);
  await expect(profile).toHaveAttribute('href', '/profissionais/professional-2/fixture-robin-brussels');
  await expect(banner.getByRole('link', { name: 'View offers' })).toHaveAttribute('href', '/ajuda');
});

test('o administrador pode salvar uma campanha exclusiva para um serviço', async ({ page }) => {
  const saved = [];
  await page.addInitScript(() => localStorage.setItem('cvp_has_session', '1'));
  await stubApi(page, {
    'POST /api/v1/auth/refresh': adminSession,
    'GET /api/v1/admin/promotions': [],
    'GET /api/v1/admin/products': [],
    'GET /api/v1/notifications': [],
    'GET /api/v1/services': [{ id: 'electrical', name: 'Fixture electrician' }],
    'POST /api/v1/admin/promotions': (request) => {
      saved.push(request.postDataJSON());
      return { id: 'fixture-service-promotion' };
    },
  });
  await page.goto(`${origin}/admin/conteudo`);
  const editor = page.locator('cvp-admin-store');
  await editor.getByRole('button', { name: 'Add campaign' }).click();
  const form = editor.locator('form.admin-editor-form');
  await form.locator('[name=promotionTitle]').fill('Priority slots');
  await form.locator('[name=promotionPlacement]').selectOption('services');
  await form.locator('[name=promotionService]').selectOption({ label: 'Fixture electrician' });
  await form.getByRole('button', { name: 'Save campaign' }).click();
  await expect(editor.getByText('Campaign saved.', { exact: true })).toBeVisible();
  expect(saved).toMatchObject([{ placement: 'services', serviceId: 'electrical', ctaLabel: null, ctaUrl: null }]);
});

test('erros de login da API são exibidos no idioma do formulário', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cvp.language', 'fr'));
  await page.route('**/api/v1/auth/login', route => route.fulfill({
    status: 401,
    json: { error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' } },
  }));
  await page.goto(`${origin}/entrar`);
  await page.locator('input[type=email]').fill('fixture@example.invalid');
  await page.locator('input[type=password]').fill('fixture-password');
  await page.locator('form button[type=submit]').click();
  await expect(page.getByRole('alert').locator('span')).toHaveText('Adresse e-mail ou mot de passe incorrect.');
});

for (const [hasSession, description] of [
  [false, 'depois do cadastro a confirmação usa o endereço cadastrado'],
  [true, 'um novo cadastro usa o endereço novo quando outra conta está aberta'],
]) {
  test(description, async ({ page }) => {
    if (hasSession) await page.addInitScript(() => localStorage.setItem('cvp_has_session', '1'));
    const email = 'new-customer@example.invalid';
    const resend = [];
    const proof = [];
    await stubApi(page, {
      'POST /api/v1/auth/refresh': { ...adminSession, user: { ...adminSession.user, emailVerified: true } },
      'POST /api/v1/auth/register/customer': {
        user: { id: 'new-customer', name: 'Fixture Customer', email, role: 'customer', emailVerified: false },
      },
      'POST /api/v1/auth/email/resend': (request) => {
        resend.push(request.postDataJSON());
        return {};
      },
      'POST /api/v1/auth/email/verify': (request) => {
        proof.push(request.postDataJSON());
        return {};
      },
    });
    await page.goto(`${origin}/cadastro`);
    const register = page.locator('cvp-register form');
    await register.locator('[name=name]').fill('Fixture Customer');
    await register.locator('[name=email]').fill(email);
    await register.locator('[name=phone]').fill('+32 471 23 45 67');
    await register.locator('[name=password]').fill('Fixture!8pass');
    await register.locator('[name=confirmation]').fill('Fixture!8pass');
    await register.locator('[name=terms]').check();
    await register.locator('[type=submit]').click();
    await expect(page).toHaveURL(`${origin}/verificar-email`);
    await page.reload();

    const confirmation = page.locator('cvp-verify-email');
    await expect(confirmation.locator('.verification-address')).toHaveText(email);
    await expect(confirmation.locator('input')).toHaveCount(1);
    await confirmation.getByRole('button', { name: 'Resend verification email' }).click();
    await expect(confirmation.getByRole('status')).toHaveText('New code and link requested.');
    expect(resend).toMatchObject([{ email }]);

    await confirmation.getByRole('textbox', { name: 'Confirmation code' }).fill('012345');
    await confirmation.getByRole('button', { name: 'Confirm code' }).click();
    await expect(confirmation.getByRole('heading', { name: 'Email verified', exact: true })).toBeVisible();
    expect(proof).toEqual([{ email, code: '012345' }]);
    await expect(confirmation.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/entrar');
  });
}

test('a confirmação direta leva ao login e usa a conta pendente da sessão', async ({ page }) => {
  const user = { id: 'pending-customer', name: 'Pending Customer', email: 'pending@example.invalid', role: 'customer', emailVerified: false };
  const session = { user, accessToken: 'verification-fixture', tokenType: 'Bearer', expiresIn: 900 };
  const proof = [];
  await stubApi(page, {
    'POST /api/v1/auth/login': session,
    'POST /api/v1/auth/refresh': session,
    'POST /api/v1/auth/email/verify': (request) => {
      proof.push(request.postDataJSON());
      return {};
    },
    'GET /api/v1/me': { ...user, emailVerified: true },
  });
  await page.goto(`${origin}/verificar-email`);
  await expect(page).toHaveURL(`${origin}/entrar`);
  const login = page.locator('cvp-login form');
  await login.locator('input[type=email]').fill(user.email);
  await login.locator('input[type=password]').fill('Fixture!8pass');
  await login.locator('button[type=submit]').click();
  await expect(page).toHaveURL(`${origin}/verificar-email`);
  await page.reload();

  const confirmation = page.locator('cvp-verify-email');
  await expect(confirmation.locator('.verification-address')).toHaveText(user.email);
  await expect(confirmation.locator('input')).toHaveCount(1);
  await confirmation.getByRole('textbox', { name: 'Confirmation code' }).fill('735001');
  await confirmation.getByRole('button', { name: 'Confirm code' }).click();
  await expect(confirmation.getByRole('link', { name: 'Open my account' })).toHaveAttribute('href', '/conta');
  expect(proof).toEqual([{ email: user.email, code: '735001' }]);
});

test('o link de confirmação funciona fora da sessão de cadastro ou login', async ({ page }) => {
  const token = 'a'.repeat(64);
  const proof = [];
  await stubApi(page, {
    'POST /api/v1/auth/email/verify': (request) => {
      proof.push(request.postDataJSON());
      return {};
    },
  });
  await page.goto(`${origin}/verificar-email#token=${token}`);
  const confirmation = page.locator('cvp-verify-email');
  await expect(confirmation.getByRole('heading', { name: 'Email verified', exact: true })).toBeVisible();
  await expect(confirmation.locator('input')).toHaveCount(0);
  expect(proof).toEqual([{ token }]);
});

test('a home mantém cada campanha por um minuto e alterna vídeo e imagem', async ({ page }) => {
  const campaign = { active: true, backgroundColor: '#096653', textColor: '#ffffff', ctaUrl: '/produtos', ctaLabel: 'Store' };
  await stubApi(page, {
    'GET /api/v1/home': {
      services: [], categories: [], professionals: [],
      promotions: [
        { ...campaign, id: 'video-first', title: 'Fixture video campaign', mediaType: 'video', imageUrl: fixtureUrl(60), videoDurationMs: 60_000 },
        { ...campaign, id: 'static-second', title: 'Fixture image campaign', mediaType: 'image', imageUrl: '/images/promo-laundry-discount-v1.webp' },
      ],
    },
  });
  await page.addInitScript(() => { Math.random = () => 0; });
  const start = new Date('2026-11-24T12:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 500));
  await page.goto(origin);

  const banner = page.locator('.home-discount-banner');
  const heading = banner.getByRole('heading', { level: 3 });
  await expect.poll(async () => {
    await page.clock.runFor(20);
    return (await heading.allTextContents())[0];
  }).toBe('Fixture video campaign');
  await page.clock.runFor(100);
  await expect(banner.locator('video')).toHaveCount(1);
  await expect(banner.locator('video[controls]')).toHaveCount(0);
  await expect(page.locator('.home-deals button')).toHaveCount(0);

  await page.clock.fastForward(59_000);
  await expect(heading).toHaveText('Fixture video campaign');
  // Advance through the boundary and let Angular flush its scheduled render.
  await page.clock.runFor(1_100);
  await expect(heading).toHaveText('Fixture image campaign');
  await expect(banner.locator('video')).toHaveCount(0);
  await expect(banner.locator('.home-discount-art img')).toHaveCount(1);

  await page.clock.fastForward(59_000);
  await expect(heading).toHaveText('Fixture image campaign');
  await page.clock.runFor(1_100);
  await expect(heading).toHaveText('Fixture video campaign');
});

for (const source of ['arquivo', 'link']) {
  test(`o editor aceita 60 segundos e rejeita 61 no vídeo por ${source}`, async ({ page }) => {
    const saves = [];
    let uploads = 0;
    await page.addInitScript(() => localStorage.setItem('cvp_has_session', '1'));
    await stubApi(page, {
      'POST /api/v1/auth/refresh': adminSession,
      'GET /api/v1/admin/promotions': [],
      'GET /api/v1/admin/products': [],
      'GET /api/v1/notifications': [],
      'POST /api/v1/admin/promotion-media': () => {
        uploads++;
        return { url: fixtureUrl(60), mediaType: 'video', videoDurationMs: null };
      },
      'POST /api/v1/admin/promotions': (request) => {
        saves.push(request.postDataJSON());
        return { id: 'fixture-campaign' };
      },
    });
    await page.goto(`${origin}/admin/conteudo`);
    const editor = page.locator('cvp-admin-store');
    await editor.getByRole('button', { name: 'Add campaign' }).click();
    const form = editor.locator('form.admin-editor-form');
    await form.locator('[name="promotionTitle"]').fill('Browser fixture campaign');
    await expect(form.getByText('Each video can be up to 1 minute long.', { exact: false })).toBeVisible();
    const selectVideo = async (length) => {
      if (source === 'arquivo') {
        await form.locator('input[type="file"][accept*="video/webm"]').setInputFiles(fixtureFile(length));
      } else {
        await form.locator('[name="promotionMediaType"]').selectOption('video');
        await form.locator('[name="promotionImage"]').fill(fixtureUrl(length));
      }
    };
    const save = form.getByRole('button', { name: 'Save campaign' });
    await selectVideo(61);
    await save.click();
    await expect(editor.getByRole('alert')).toHaveText('Campaign videos must be no longer than 1 minute.');
    expect(saves).toHaveLength(0);
    expect(uploads).toBe(0);

    await selectVideo(60);
    await save.click();
    await expect(editor.getByText('Campaign saved.', { exact: true })).toBeVisible();
    expect(saves).toMatchObject([{ mediaType: 'video', imageUrl: fixtureUrl(60), videoDurationMs: 60_000 }]);
    expect(uploads).toBe(source === 'arquivo' ? 1 : 0);
  });
}
