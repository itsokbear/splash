import { expect, test, type Page } from '@playwright/test';
import data from '../../plukh_codex/levels.json' with { type: 'json' };
async function jump(page: Page, target: number[]) {
  const cell = page.getByTestId(`cell-${target.join('-')}`);
  await cell.click(); await cell.click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'false');
  await expect(page.getByTestId('frog')).toHaveAttribute('data-at', target.join(','));
}
test('first level: preview, atomic move, undo, win and durable progress', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByTestId('moves')).toHaveText('0');
  await expect(page.getByTestId('frog')).toHaveAttribute('data-at', '0,3');
  await expect(page.getByTestId('pad-p2')).toHaveAttribute('data-at', '3,3');
  await page.getByTestId('cell-2-3').click();
  await expect(page.getByTestId('wave-preview')).toBeVisible();
  await expect(page.getByTestId('moves')).toHaveText('0');
  await expect(page.getByTestId('frog')).toHaveAttribute('data-at', '0,3');
  await page.getByTestId('cell-2-3').click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'false');
  await expect(page.getByTestId('frog')).toHaveAttribute('data-at', '2,3');
  await expect(page.getByTestId('pad-p2')).toHaveAttribute('data-at', '4,3');
  await expect(page.getByTestId('moves')).toHaveText('1');
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await expect(page.getByTestId('pad-p2')).toHaveAttribute('data-at', '3,3');
  await expect(page.getByTestId('frog')).toHaveAttribute('data-at', '0,3');
  await expect(page.getByTestId('moves')).toHaveText('0');
  for (const target of data.levels[0].referenceSolution) await jump(page, target);
  await expect(page.getByRole('heading', { name: 'Ты дома!' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('moves')).toHaveText('0');
  await page.getByRole('button', { name: 'Выбрать уровень' }).click();
  await expect(page.getByRole('button', { name: /02 За поворотом/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /01 Первый плюх/ })).toContainText('Лучший результат: 3');
  expect(errors).toEqual([]);
});
test('all twenty levels, worker hints, last victory, replay and victory undo', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  for (const [index, level] of data.levels.entries()) {
    await expect(page.getByTestId('level-number')).toHaveText(`Уровень ${index + 1}`);
    await page.getByRole('button', { name: 'Подсказка' }).click();
    await expect(page.getByTestId('hint-marker')).toBeVisible();
    if ([5, 17, 18, 19].includes(index)) await page.screenshot({ path: `test-results/${testInfo.project.name}-level-${index + 1}.png` });
    for (const target of level.referenceSolution) await jump(page, target);
    await expect(page.getByRole('heading', { name: 'Ты дома!' })).toBeVisible();
    if (index < data.levels.length - 1) await page.getByRole('button', { name: 'Следующий уровень' }).click();
  }
  const last = data.levels.at(-1)!;
  await expect(page.getByRole('button', { name: 'Следующий уровень' })).toHaveCount(0);
  await expect(page.getByTestId('dialog')).toContainText('Все уровни пройдены');
  await page.getByRole('button', { name: 'Отменить последний ход' }).click();
  await expect(page.getByTestId('dialog')).not.toBeVisible();
  await expect(page.getByTestId('moves')).toHaveText(String(last.optimalMoves - 1));
  await jump(page, last.goal);
  await page.getByRole('button', { name: 'Переиграть' }).click();
  await expect(page.getByTestId('moves')).toHaveText('0');
  await expect(page.getByTestId('level-number')).toHaveText('Уровень 20');
});
test('old progress opens level six and the twenty-level list remains usable', async ({ page }, testInfo) => {
  const best = Object.fromEntries(data.levels.slice(0, 5).map(l => [l.id, l.optimalMoves]));
  await page.addInitScript(best => {
    if (!localStorage.getItem('plukh.progress.v1')) localStorage.setItem('plukh.progress.v1', JSON.stringify({ version: 1, best, lastLevel: 'level-05', sound: false }));
  }, best);
  await page.goto('./');
  await page.getByRole('button', { name: 'Выбрать уровень' }).click();
  await expect(page.locator('.level-option')).toHaveCount(20);
  await expect(page.getByTestId('dialog')).toContainText('Пройдено 5 из 20');
  await expect(page.locator('[data-level="5"]')).toBeEnabled();
  await expect(page.locator('[data-level="6"]')).toBeDisabled();
  await page.locator('[data-level="19"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-level="19"]')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Закрыть', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: `test-results/${testInfo.project.name}-levels.png` });
  await page.locator('[data-level="5"]').click();
  await expect(page.getByTestId('level-number')).toHaveText('Уровень 6');
  await page.reload();
  await expect(page.getByTestId('level-number')).toHaveText('Уровень 6');
  await page.getByRole('button', { name: 'Выбрать уровень' }).click();
  await expect(page.locator('[data-level="5"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('dialog')).not.toBeVisible();
});
test('keyboard selection, Escape, menu, sound and restart confirmation', async ({ page }) => {
  await page.goto('./');
  const target = page.getByTestId('cell-2-3');
  await target.focus(); await page.keyboard.press('Enter');
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape'); await expect(target).toHaveAttribute('aria-pressed', 'false');
  await target.focus(); await page.keyboard.press('Space'); await page.keyboard.press('Space');
  await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'false');
  await expect(page.getByTestId('moves')).toHaveText('1');
  await page.keyboard.press('u'); await expect(page.getByTestId('moves')).toHaveText('0');
  await jump(page, [2, 3]);
  await page.getByRole('button', { name: 'Заново', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Начать уровень заново?' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByTestId('moves')).toHaveText('1');
  await page.getByRole('button', { name: 'Заново', exact: true }).click();
  await page.getByTestId('dialog').getByRole('button', { name: 'Заново', exact: true }).click();
  await expect(page.getByTestId('moves')).toHaveText('0');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Тихий час' })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('switch').click(); await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape'); await expect(page.getByTestId('dialog')).not.toBeVisible();
});
test('hint from current state and dragging never confirms a jump', async ({ page }) => {
  await page.goto('./'); await jump(page, [2, 3]); await jump(page, [0, 3]);
  await page.getByRole('button', { name: 'Подсказка' }).click();
  await expect(page.getByTestId('hint-marker')).toBeVisible();
  await expect(page.getByTestId('moves')).toHaveText('2');
  const cell = page.getByTestId('cell-2-3'); await cell.click();
  const box = (await cell.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2); await page.mouse.up();
  await expect(page.getByTestId('moves')).toHaveText('2');
  await page.getByTestId('cell-0-0').click(); await expect(cell).toHaveAttribute('aria-pressed', 'false');
});
test('touch, animation lock and reduced motion', async ({ page, isMobile }) => {
  await page.goto('./'); const cell = page.getByTestId('cell-2-3');
  if (isMobile) { await cell.tap(); await cell.tap(); } else { await cell.click(); await cell.click(); }
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Заново', exact: true })).toBeDisabled();
  await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await jump(page, [4, 3]);
  await expect(page.getByTestId('moves')).toHaveText('2');
});
test('old worker reply cannot highlight a new level', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('plukh.progress.v1', JSON.stringify({ version: 1, best: { 'level-01': 3 }, lastLevel: 'level-01', sound: false }));
    class DelayedWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror = null;
      terminate() {}
      postMessage(data: { revision: number }) { setTimeout(() => this.onmessage?.({ data: { revision: data.revision, result: { status: 'solved', path: [[2, 3]], visited: 3 } } }), 1000); }
    }
    Object.defineProperty(window, 'Worker', { value: DelayedWorker });
  });
  await page.goto('./'); await page.getByRole('button', { name: 'Подсказка' }).click();
  await page.getByRole('button', { name: 'Выбрать уровень' }).click();
  await page.getByRole('button', { name: /02 За поворотом/ }).click();
  await expect(page.getByTestId('level-number')).toHaveText('Уровень 2');
  await page.waitForTimeout(1100);
  await expect(page.getByTestId('hint-marker')).toHaveCount(0);
});
test('storage and worker failures do not stop play', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
    Object.defineProperty(window, 'Worker', { value: class { constructor() { throw new Error('unavailable'); } } });
  });
  await page.goto('./'); await page.getByRole('button', { name: 'Подсказка' }).click();
  await expect(page.getByTestId('guidance-text')).toContainText('Не удалось быстро');
  for (const target of data.levels[0].referenceSolution) await jump(page, target);
  await expect(page.getByRole('heading', { name: 'Ты дома!' })).toBeVisible();
});
test('viewport fit and visual snapshots', async ({ page }, testInfo) => {
  await page.goto('./');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Подсказка' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: `test-results/${testInfo.project.name}-initial.png`, fullPage: true });
  await page.getByTestId('cell-2-3').click();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-preview.png`, fullPage: true });
});
test('menu finishes animation, level change warns, landscape stays playable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('plukh.progress.v1', JSON.stringify({ version: 1, best: { 'level-01': 3 }, lastLevel: 'level-01', sound: false })));
  await page.goto('./');
  await page.getByTestId('cell-2-3').click(); await page.getByTestId('cell-2-3').click();
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByTestId('frog')).toHaveAttribute('data-at', '2,3');
  await expect(page.getByTestId('pad-p2')).toHaveAttribute('data-at', '4,3');
  await page.getByRole('button', { name: 'Выбрать уровень' }).click();
  await page.getByRole('button', { name: /02 За поворотом/ }).click();
  await expect(page.getByRole('heading', { name: 'Перейти к другому пруду?' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByTestId('moves')).toHaveText('1');
  await page.getByRole('button', { name: 'Выбрать уровень' }).click();
  await page.getByRole('button', { name: /02 За поворотом/ }).click();
  await page.getByRole('button', { name: 'Перейти', exact: true }).click();
  await expect(page.getByTestId('level-number')).toHaveText('Уровень 2');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'Подсказка' })).toBeInViewport({ ratio: 1 });
  await jump(page, [2, 5]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
