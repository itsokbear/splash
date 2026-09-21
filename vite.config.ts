import { defineConfig } from 'vitest/config';
import { pwa } from './scripts/pwa.ts';
export default defineConfig({
  base: './',
  plugins: [pwa()],
  test: { include: ['tests/**/*.test.ts'] },
});
