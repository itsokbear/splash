import type { Cell, GameState, LevelDefinition, MoveResult, WaveAttempt } from './types';
export const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const contains = (cells: readonly Cell[], at: Cell) => cells.some(c => same(c, at));
export const inside = (l: LevelDefinition, c: Cell) => c.length === 2 && c.every(Number.isInteger) && c[0] >= 0 && c[0] < l.width && c[1] >= 0 && c[1] < l.height;
export const directions: readonly Cell[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function validateLevel(l: LevelDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (l.width !== 7 || l.height !== 7) errors.push('Поле должно быть 7 × 7');
  if (!l.id || !l.title) errors.push('Нет названия или ID');
  const occupied = new Set<string>();
  for (const at of [...l.land, ...l.rocks, ...l.pads.map(p => p.at)]) {
    if (!inside(l, at)) errors.push('Некорректная координата');
    const key = at.join(',');
    if (occupied.has(key)) errors.push('Пересечение объектов');
    occupied.add(key);
  }
  if (new Set(l.pads.map(p => p.id)).size !== l.pads.length || l.pads.some(p => !p.id)) errors.push('Некорректные ID листьев');
  if (!inside(l, l.start) || !inside(l, l.goal) || !contains(l.land, l.start) || !contains(l.land, l.goal) || same(l.start, l.goal)) errors.push('Некорректные старт или домик');
  return { valid: errors.length === 0, errors };
}
export function createInitialState(l: LevelDefinition): GameState {
  return { frog: [...l.start], pads: l.pads.map(p => ({ id: p.id, at: [...p.at] })), moves: 0, status: 'playing' };
}
export function isLegalTarget(l: LevelDefinition, s: GameState, t: Cell): boolean {
  if (s.status === 'won' || !inside(l, t)) return false;
  const dx = t[0] - s.frog[0], dy = t[1] - s.frog[1], distance = Math.abs(dx) + Math.abs(dy);
  if ((dx !== 0 && dy !== 0) || distance < 1 || distance > 2) return false;
  if (contains(l.rocks, t) || (!contains(l.land, t) && !s.pads.some(p => same(p.at, t)))) return false;
  return distance !== 2 || !contains(l.rocks, [s.frog[0] + dx / 2, s.frog[1] + dy / 2]);
}
export function getLegalTargets(l: LevelDefinition, s: GameState): Cell[] {
  const targets: Cell[] = [];
  for (const [dx, dy] of directions) for (const distance of [1, 2]) {
    const t: Cell = [s.frog[0] + dx * distance, s.frog[1] + dy * distance];
    if (isLegalTarget(l, s, t)) targets.push(t);
  }
  return targets;
}
export function simulateMove(l: LevelDefinition, s: GameState, target: Cell): MoveResult {
  if (!isLegalTarget(l, s, target)) return { ok: false, reason: 'Недопустимая цель' };
  const wave: WaveAttempt[] = [];
  if (s.pads.some(p => same(p.at, target))) {
    for (const [dx, dy] of directions) {
      const from: Cell = [target[0] + dx, target[1] + dy];
      const pad = s.pads.find(p => same(p.at, from));
      if (!pad) continue;
      const to: Cell = [from[0] + dx, from[1] + dy];
      const blockedBy = !inside(l, to) ? 'boundary' : contains(l.land, to) ? 'land' : contains(l.rocks, to) ? 'rock' : s.pads.some(p => same(p.at, to)) ? 'pad' : null;
      wave.push({ padId: pad.id, from: pad.at, to, blockedBy });
    }
  }
  const pads = s.pads.map(p => {
    const move = wave.find(w => w.padId === p.id && !w.blockedBy);
    return { id: p.id, at: move ? move.to : p.at };
  });
  return { ok: true, next: { frog: [...target], pads, moves: s.moves + 1, status: same(target, l.goal) ? 'won' : 'playing' }, jump: { from: s.frog, to: target }, wave };
}
