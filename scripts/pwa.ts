import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/** Cache the complete production output, including public art and the solver Worker. */
export function pwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'plukh-offline',
    apply: 'build',
    configResolved(resolved) { config = resolved; },
    async closeBundle() {
      const directory = resolve(config.root, config.build.outDir);
      const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name !== 'sw.js')
        .map(entry => resolve(entry.parentPath, entry.name).slice(directory.length + 1))
        .sort();
      const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
      const hash = createHash('sha256').update(template);
      for (const file of files) hash.update(file).update(await readFile(resolve(directory, file)));
      const worker = template.replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 20)))
        .replace('__PRECACHE__', JSON.stringify(files));
      await writeFile(resolve(directory, 'sw.js'), worker);
    },
  };
}
