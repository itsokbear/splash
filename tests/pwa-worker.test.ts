import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../scripts/service-worker.js', import.meta.url), 'utf8')
  .replace('__VERSION__', '"new"')
  .replace('__PRECACHE__', JSON.stringify(['index.html', 'assets/game.js', 'assets/solver.js']));
const scope = 'https://example.test/splash/';
const prefix = 'plukh-pwa:/splash/:';

function worker(failInstall = false) {
  const listeners = new Map<string, (event: unknown) => void>();
  const entries = new Map<string, Response>();
  const names = new Set([`${prefix}old`, 'another-game', 'plukh-pwa:/other/:old']);
  const cache = {
    addAll: vi.fn(async (requests: Request[]) => {
      if (failInstall) throw new Error('offline');
      for (const request of requests) entries.set(request.url, new Response('cached'));
    }),
    match: async (key: string) => entries.get(key)?.clone(),
  };
  const storage = {
    open: async (name: string) => { names.add(name); return cache; },
    keys: async () => [...names],
    delete: vi.fn(async (name: string) => names.delete(name)),
  };
  const claim = vi.fn(), skipWaiting = vi.fn();
  const network = vi.fn(async () => new Response('network'));
  runInNewContext(source, {
    self: { registration: { scope }, clients: { claim }, skipWaiting,
      addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler) },
    caches: storage, URL, Request, fetch: network,
  });
  const dispatch = (name: string, request?: { url: string; mode?: string; method: string }) => {
    let result: Promise<Response | undefined> | undefined;
    listeners.get(name)!({ request, waitUntil: (promise: typeof result) => { result = promise; },
      respondWith: (promise: typeof result) => { result = promise; } });
    return result;
  };
  return { dispatch, names, cache, network, claim, skipWaiting };
}

describe('offline updates', () => {
  it('prepares every file without taking over a running game', async () => {
    const sw = worker();
    await sw.dispatch('install');
    expect(sw.cache.addAll.mock.calls[0][0].map(request => [request.url, request.cache])).toEqual([
      [`${scope}index.html`, 'reload'], [`${scope}assets/game.js`, 'reload'], [`${scope}assets/solver.js`, 'reload'],
    ]);
    expect(sw.skipWaiting).not.toHaveBeenCalled();
    expect(sw.claim).not.toHaveBeenCalled();
    expect(sw.names.has(`${prefix}old`)).toBe(true);
  });
  it('retains the working version if an update cannot be fully downloaded', async () => {
    const sw = worker(true);
    await expect(sw.dispatch('install')).rejects.toThrow('offline');
    expect(sw.names.has(`${prefix}new`)).toBe(false);
    expect(sw.names.has(`${prefix}old`)).toBe(true);
  });
  it('removes only previous versions of this app on activation', async () => {
    const sw = worker();
    await sw.dispatch('install');
    await sw.dispatch('activate');
    expect([...sw.names].sort()).toEqual(['another-game', 'plukh-pwa:/other/:old', `${prefix}new`].sort());
    expect(sw.claim).toHaveBeenCalledOnce();
  });
  it('serves offline navigation and solver files without intercepting other apps or writes', async () => {
    const sw = worker();
    await sw.dispatch('install');
    for (const url of [scope, `${scope}?source=homescreen`, `${scope}index.html`]) {
      expect(await (await sw.dispatch('fetch', { url, method: 'GET', mode: 'navigate' }))?.text()).toBe('cached');
    }
    expect(await (await sw.dispatch('fetch', { url: `${scope}assets/solver.js`, method: 'GET' }))?.text()).toBe('cached');
    for (const request of [
      { url: 'https://elsewhere.test/splash/', method: 'GET', mode: 'navigate' },
      { url: 'https://example.test/other/', method: 'GET', mode: 'navigate' },
      { url: `${scope}assets/game.js`, method: 'POST' },
      { url: `${scope}missing`, method: 'GET', mode: 'navigate' },
    ]) expect(sw.dispatch('fetch', request)).toBeUndefined();
    expect(sw.network).not.toHaveBeenCalled();
  });
});
