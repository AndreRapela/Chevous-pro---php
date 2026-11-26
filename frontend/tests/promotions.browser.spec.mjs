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
let server;
let origin;

test.use({ locale: 'en-US', channel: process.env.CVP_BROWSER_CHANNEL || undefined });

test.beforeAll(async () => {
  await access(pageShell);
  const app = express();
  app.use('/fixtures', express.static(fixtures));
  app.use(express.static(build, { index: false }));
  app.get(['/', '/admin/conteudo'], (_request, response) => response.sendFile(pageShell));
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
      'POST /api/v1/auth/refresh': {
        user: { id: 'fixture-admin', email: 'admin@example.invalid', name: 'Fixture Admin', role: 'admin' },
        accessToken: 'browser-fixture',
      },
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
