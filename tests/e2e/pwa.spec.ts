import { expect, test } from '@playwright/test';
import data from '../../plukh_codex/levels.json' with { type: 'json' };

test.beforeEach(() => {
  test.skip(!process.env.PLUKH_URL, 'PWA проверяется на production-сборке в Docker.');
});

test('PWA: install metadata, offline reload, progress, graphics and Worker hints', async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    Object.defineProperty(navigator.serviceWorker, 'register', { value: (url: string | URL, options?: RegistrationOptions) => {
      document.documentElement.dataset.pwaRegisteredAt = document.readyState;
      return register(url, options);
    } });
  });
  await page.goto('./');
  const manifestUrl = await page.locator('link[rel="manifest"]').evaluate((link: HTMLLinkElement) => link.href);
  const response = await page.request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(new URL('./', page.url()).href);
  expect(manifest.id).toBe('./');
  expect(manifest.scope).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  for (const icon of manifest.icons) {
    const result = await page.request.get(new URL(icon.src, manifestUrl).href);
    expect(result.headers()['content-type']).toContain('image/png');
    const bytes = await result.body();
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js'));
  await expect(page.locator('html')).toHaveAttribute('data-pwa-registered-at', 'complete');
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: 'Установить игру', exact: true }).click();
  await expect(page.getByTestId('offline-status')).toContainText('Всё готово');
  await page.screenshot({ path: `test-results/${testInfo.project.name}-pwa-install.png`, fullPage: true });
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const target of data.levels[0].referenceSolution) {
    const cell = page.getByTestId(`cell-${target.join('-')}`);
    await cell.click(); await cell.click();
    await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'false');
  }
  await expect(page.getByRole('heading', { name: 'Ты дома!' })).toBeVisible();
  await page.getByRole('button', { name: 'Следующий уровень' }).click();
  await context.setOffline(true);
  await page.goto(new URL('?offline=1', page.url()).href);
  await expect(page.getByTestId('level-number')).toHaveText('Уровень 2');
  await page.getByRole('button', { name: 'Подсказка' }).click();
  await expect(page.getByTestId('hint-marker')).toBeVisible();
  const first = page.getByTestId(`cell-${data.levels[1].referenceSolution[0].join('-')}`);
  await first.click(); await first.click();
  await expect(page.getByTestId('moves')).toHaveText('1');
  for (const path of ['art/reference-ui.png', 'favicon.svg']) {
    expect(await page.evaluate(async path => (await fetch(new URL(path, document.baseURI))).ok, path)).toBe(true);
  }
  await page.screenshot({ path: `test-results/${testInfo.project.name}-pwa-offline.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('PWA: install prompt opens only on request and is consumed once', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => { document.documentElement.dataset.installPrompts = '1'; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-install-prompts');
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: 'Установить игру', exact: true }).click();
  await page.getByRole('button', { name: 'Установить', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-install-prompts', '1');
  await expect(page.getByRole('button', { name: 'Установить', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('heading', { name: 'Игра с собой' })).toBeVisible();
});

test('PWA: denied offline storage does not prevent playing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(new Error('denied')) });
  });
  await page.goto('./');
  const cell = page.getByTestId('cell-2-3');
  await cell.click(); await cell.click();
  await expect(page.getByTestId('moves')).toHaveText('1');
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: 'Установить игру', exact: true }).click();
  await expect(page.getByTestId('offline-status')).toContainText('Офлайн-режим пока недоступен');
});
