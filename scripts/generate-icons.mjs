import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const output = process.argv[2] || '/tmp/plukh-icons';
await mkdir(output, { recursive: true });
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  for (const [name, size, padding] of [
    ['icon-192', 192, 0], ['icon-512', 512, 0],
    ['apple-touch-icon', 180, 0], ['maskable-512', 512, 80],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>body{margin:0;background:#dcebbb;padding:${padding}px}svg{display:block;width:100%;height:auto}</style>${svg}`);
    await page.screenshot({ path: `${output}/${name}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
