import { expect, it } from 'vitest';
import data from '../plukh_codex/levels.json';
import type { LevelDefinition } from '../src/core/types';
import { GameSession } from '../src/app/session';
import { isUnlocked, readProgress, recordWin, writeProgress } from '../src/app/storage';
const levels = data.levels as unknown as LevelDefinition[];
it('preview, invalid input, atomic locking, multiple undo and win undo', () => {
  const s = new GameSession(levels[0]), initial = structuredClone(s.state);
  s.select([2, 3]); expect(s.state).toEqual(initial); expect(s.history).toHaveLength(0);
  s.select([0, 0]); expect(s.selected).toBeNull(); expect(s.history).toHaveLength(0);
  for (const target of levels[0].referenceSolution) {
    s.select(target); s.select(target);
    const snapshot = s.state;
    s.select([0, 3]); expect(s.state).toEqual(snapshot); expect(s.undo()).toBe(false); expect(s.restart()).toBe(false);
    s.busy = false;
  }
  expect(s.state.status).toBe('won'); s.undo(); expect(s.state.status).toBe('playing');
  s.undo(); s.undo(); expect(s.state).toEqual(initial); expect(s.undo()).toBe(false);
});
it('restart and change level clear history and invalidate hints', () => {
  const s = new GameSession(levels[0]); s.select([2, 3]); s.select([2, 3]); s.busy = false;
  const rev = s.revision; s.restart(); expect(s.state.moves).toBe(0); expect(s.revision).toBeGreaterThan(rev);
  s.select([2, 3]); s.changeLevel(levels[1]); expect(s.selected).toBeNull(); expect(s.history).toHaveLength(0);
});
it('wins persist, best only improves and unlocks next level', () => {
  let stored = ''; const storage = { getItem: () => stored, setItem: (_: string, value: string) => { stored = value; } };
  let p = readProgress(levels, storage); expect(isUnlocked(levels, p, 1)).toBe(false);
  p = recordWin(p, levels[0].id, 5); p = recordWin(p, levels[0].id, 7); expect(p.best[levels[0].id]).toBe(5);
  p = recordWin(p, levels[0].id, 3); writeProgress(p, storage);
  expect(readProgress(levels, storage).best[levels[0].id]).toBe(3); expect(isUnlocked(levels, p, 1)).toBe(true);
});
it('existing five-level progress keeps records and unlocks the expanded campaign', () => {
  const best = Object.fromEntries(levels.slice(0, 5).map(l => [l.id, l.optimalMoves]));
  const saved = { version: 1, best, lastLevel: 'level-05', sound: true };
  const progress = readProgress(levels, { getItem: () => JSON.stringify(saved), setItem: () => {} });
  expect(progress).toEqual(saved);
  expect(isUnlocked(levels, progress, 5)).toBe(true);
  expect(isUnlocked(levels, progress, 6)).toBe(false);
  const won = recordWin(progress, levels[5].id, levels[5].optimalMoves);
  expect(isUnlocked(levels, won, 6)).toBe(true);
  expect(won.best).toMatchObject(best);
});
it('storage handles corrupt JSON, schema, invalid values, unknown/locked levels and exceptions', () => {
  for (const raw of ['{bad', 'null', '{"version":2}', '{"version":1,"best":{"level-01":-2,"alien":3},"lastLevel":"level-05","sound":"yes"}']) {
    expect(readProgress(levels, { getItem: () => raw, setItem: () => {} })).toEqual({ version: 1, best: {}, lastLevel: 'level-01', sound: false });
  }
  const denied = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); } };
  const p = readProgress(levels, denied); expect(() => writeProgress(p, denied)).not.toThrow();
});
