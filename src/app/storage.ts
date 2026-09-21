import type { LevelDefinition } from '../core/types';
export const STORAGE_KEY = 'plukh.progress.v1';
export interface Progress { version: 1; best: Record<string, number>; lastLevel: string; sound: boolean }
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function isUnlocked(levels: readonly LevelDefinition[], progress: Progress, index: number) {
  return index >= 0 && index < levels.length && (index === 0 || levels.slice(0, index).every(l => progress.best[l.id] !== undefined));
}
export function readProgress(levels: readonly LevelDefinition[], storage?: StorageLike): Progress {
  const progress: Progress = { version: 1, best: {}, lastLevel: levels[0].id, sound: false };
  try {
    const raw = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (!raw || raw.version !== 1) return progress;
    if (raw.best && typeof raw.best === 'object') for (const l of levels) {
      const v = raw.best[l.id];
      if (Number.isSafeInteger(v) && v >= l.optimalMoves) progress.best[l.id] = v;
    }
    progress.sound = raw.sound === true;
    const index = levels.findIndex(l => l.id === raw.lastLevel);
    if (isUnlocked(levels, progress, index)) progress.lastLevel = levels[index].id;
  } catch { /* A storage failure must not stop play. */ }
  return progress;
}
export function writeProgress(progress: Progress, storage?: StorageLike) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Keep in-memory progress. */ }
}
export function recordWin(progress: Progress, levelId: string, moves: number): Progress {
  return { ...progress, best: { ...progress.best, [levelId]: Math.min(progress.best[levelId] ?? Infinity, moves) } };
}
