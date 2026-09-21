import { describe, expect, it } from 'vitest';
import data from '../plukh_codex/levels.json';
import type { Cell, GameState, LevelDefinition } from '../src/core/types';
import { createInitialState, getLegalTargets, inside, same, simulateMove, validateLevel } from '../src/core/rules';
import { getStateKey, solveFromState } from '../src/core/solver';
const levels = data.levels as unknown as LevelDefinition[];
const fixture = (pads: Cell[], rocks: Cell[] = [], land: Cell[] = [[0, 3], [6, 6]]): LevelDefinition => ({ ...levels[0], goal: [6, 6], land, rocks, pads: pads.map((at, i) => ({ id: `p${i}`, at })) });
function step(l: LevelDefinition, s: GameState, target: Cell) {
  const result = simulateMove(l, s, target);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  expect(result.next.pads).toHaveLength(s.pads.length);
  expect(new Set(result.next.pads.map(p => p.at.join(','))).size).toBe(s.pads.length);
  for (const p of result.next.pads) {
    expect(inside(l, p.at)).toBe(true);
    expect([...l.land, ...l.rocks].some(c => same(c, p.at))).toBe(false);
  }
  expect([...l.land, ...result.next.pads.map(p => p.at)].some(c => same(c, result.next.frog))).toBe(true);
  expect(result.next.moves).toBe(s.moves + 1);
  return result;
}
describe('canonical levels', () => {
  it('keeps the original campaign and adds fifteen distinct challenges of 9–30 moves', () => {
    expect(levels).toHaveLength(20);
    expect(levels.slice(0, 5).map(l => l.optimalMoves)).toEqual([3, 5, 5, 9, 12]);
    expect(levels.map(l => l.id)).toEqual(Array.from({ length: 20 }, (_, i) => `level-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(levels.map(l => l.title)).size).toBe(levels.length);
    for (const l of levels.slice(5)) {
      expect(l.optimalMoves).toBeGreaterThanOrEqual(levels[3].optimalMoves);
      expect(l.optimalMoves).toBeLessThanOrEqual(30);
    }
    expect(levels.slice(5).filter(l => l.rocks.length).length).toBeGreaterThanOrEqual(8);
    expect(levels.slice(5).filter(l => !l.rocks.length).length).toBeGreaterThanOrEqual(3);
  });
  for (const l of levels) it(`${l.id}: every reachable transition preserves invariants`, () => {
    const queue = [createInitialState(l)], seen = new Set([getStateKey(l, queue[0])]);
    for (let head = 0; head < queue.length; head++) {
      for (const target of getLegalTargets(l, queue[head])) {
        const next = step(l, queue[head], target).next, key = getStateKey(l, next);
        if (!seen.has(key)) { seen.add(key); queue.push(next); }
      }
    }
    expect(queue.some(s => s.status === 'won')).toBe(true);
  });
  it('level four requires a leftward jump', () => {
    const l = levels[3], queue = [createInitialState(l)], seen = new Set([getStateKey(l, queue[0])]);
    for (let head = 0; head < queue.length; head++) {
      for (const target of getLegalTargets(l, queue[head]).filter(t => t[0] >= queue[head].frog[0])) {
        const next = step(l, queue[head], target).next, key = getStateKey(l, next);
        if (!seen.has(key)) { seen.add(key); queue.push(next); }
      }
    }
    expect(queue.some(s => s.status === 'won')).toBe(false);
  });
  for (const [index, l] of levels.entries()) it(`level ${index + 1}: reference and independent BFS optimum ${l.optimalMoves}`, () => {
    expect(validateLevel(l)).toEqual({ valid: true, errors: [] });
    let s = createInitialState(l);
    for (const target of l.referenceSolution) s = step(l, s, target).next;
    expect(s.status).toBe('won');
    expect(s.moves).toBe(l.optimalMoves);
    expect(getLegalTargets(l, s)).toEqual([]);
    const solution = solveFromState(l, createInitialState(l), { maxStates: 50_000, maxMs: 10_000 });
    expect(solution.status).toBe('solved');
    if (solution.status === 'solved') expect(solution.path).toHaveLength(l.optimalMoves);
  });
  for (const l of levels.slice(5)) it(`${l.id}: hints solve an intermediate state within the normal budget`, () => {
    const prefix = Math.floor(l.referenceSolution.length / 2);
    let state = createInitialState(l);
    for (const target of l.referenceSolution.slice(0, prefix)) state = step(l, state, target).next;
    const hint = solveFromState(l, state);
    expect(hint.status).toBe('solved');
    if (hint.status === 'solved') {
      expect(hint.path).toHaveLength(l.optimalMoves - prefix);
      for (const target of hint.path) state = step(l, state, target).next;
      expect(state.status).toBe('won');
    }
  });
  for (const l of levels.slice(5).filter(l => l.rocks.length)) it(`${l.id}: every rock changes the puzzle`, () => {
    let state = createInitialState(l), rockBlocks = 0;
    for (const target of l.referenceSolution) {
      const result = step(l, state, target);
      rockBlocks += result.wave.filter(w => w.blockedBy === 'rock').length;
      state = result.next;
    }
    expect(rockBlocks).toBeGreaterThan(0);
    for (const removed of l.rocks) {
      const withoutRock = { ...l, rocks: l.rocks.filter(r => r !== removed) };
      const result = solveFromState(withoutRock, createInitialState(withoutRock), { maxStates: 50_000, maxMs: 10_000 });
      expect(result.status).not.toBe('budget_exceeded');
      if (result.status === 'solved') expect(result.path.length).not.toBe(l.optimalMoves);
    }
  });
  it('only one initial target on first level', () => expect(getLegalTargets(levels[0], createInitialState(levels[0]))).toEqual([[2, 3]]));
});
describe('rules and waves', () => {
  it.each<Cell>([[1, 2], [3, 3], [0, 3], [1, 3], [-1, 3], [7, 3], [1.5, 3]])('rejects invalid target %j without mutation', (x, y) => {
    const l = levels[0], s = createInitialState(l), before = structuredClone(s);
    expect(simulateMove(l, s, [x, y]).ok).toBe(false); expect(s).toEqual(before);
  });
  it('allows distance one; departure pad is pushed without frog', () => {
    const l = fixture([[2, 3], [3, 3]]), s = { ...createInitialState(l), frog: [2, 3] as Cell };
    const r = step(l, s, [3, 3]);
    expect(r.next.frog).toEqual([3, 3]); expect(r.next.pads[0].at).toEqual([1, 3]); expect(r.next.pads[1].at).toEqual([3, 3]);
  });
  it('rock blocks flight over intermediate cell', () => {
    const l = fixture([[2, 3]], [[1, 3]]);
    expect(simulateMove(l, createInitialState(l), [2, 3]).ok).toBe(false);
  });
  it('land landing creates no wave, even when flying over a pad', () => {
    const l = fixture([[1, 3], [3, 3]], [], [[0, 3], [2, 3], [6, 6]]), s = createInitialState(l);
    const r = step(l, s, [2, 3]); expect(r.wave).toEqual([]); expect(r.next.pads).toEqual(s.pads);
  });
  it('four simultaneous shifts, diagonal and distant leaves stay still; immutable inputs', () => {
    const l = fixture([[3, 3], [3, 2], [4, 3], [3, 4], [2, 3], [4, 4], [5, 5]], [], [[3, 5], [6, 6]]);
    const s = { ...createInitialState(l), frog: [3, 5] as Cell }, before = structuredClone(s);
    const r = step(l, s, [3, 3]);
    expect(r.wave).toHaveLength(4);
    expect(r.next.pads.map(p => p.at)).toEqual([[3, 3], [3, 1], [5, 3], [3, 4], [1, 3], [4, 4], [5, 5]]);
    expect(s).toEqual(before);
  });
  it.each(['rock', 'land', 'pad', 'boundary'] as const)('blocks wave by %s without rejecting jump', reason => {
    let l = fixture([[2, 3], [3, 3]], reason === 'rock' ? [[4, 3]] : [], reason === 'land' ? [[0, 3], [4, 3], [6, 6]] : undefined);
    if (reason === 'pad') l = fixture([[2, 3], [3, 3], [4, 3]]);
    let s = createInitialState(l), target: Cell = [2, 3];
    if (reason === 'boundary') { l = fixture([[5, 3], [6, 3]], [], [[3, 3], [6, 6]]); s = { ...createInitialState(l), frog: [3, 3] }; target = [5, 3]; }
    const r = step(l, s, target); expect(r.wave[0].blockedBy).toBe(reason); expect(r.next.pads).toEqual(s.pads);
  });
  it('array order has no effect', () => {
    const l = fixture([[2, 3], [3, 3], [2, 2]]), s = createInitialState(l);
    const a = step(l, s, [2, 3]), b = step(l, { ...s, pads: [...s.pads].reverse() }, [2, 3]);
    expect(getStateKey(l, a.next)).toBe(getStateKey(l, b.next));
  });
  it('detects invalid level definitions', () => {
    expect(validateLevel({ ...levels[0], pads: [...levels[0].pads, levels[0].pads[0]] }).valid).toBe(false);
    expect(validateLevel({ ...levels[0], start: [7, 3] }).valid).toBe(false);
    expect(validateLevel({ ...levels[0], goal: levels[0].start }).valid).toBe(false);
    expect(validateLevel({ ...levels[0], width: 8 }).valid).toBe(false);
  });
});
describe('solver', () => {
  it('solves an intermediate state and a deviation from reference', () => {
    const l = levels[1];
    let s = step(l, createInitialState(l), [2, 5]).next;
    expect(solveFromState(l, s)).toMatchObject({ status: 'solved', path: l.referenceSolution.slice(1) });
    s = step(l, s, [0, 5]).next;
    const result = solveFromState(l, s);
    expect(result.status).toBe('solved');
    if (result.status === 'solved') { for (const target of result.path) s = step(l, s, target).next; expect(s.status).toBe('won'); }
  });
  it('keys ignore IDs, moves, array order', () => {
    const l = levels[1], s = createInitialState(l);
    expect(getStateKey(l, s)).toBe(getStateKey(l, { ...s, moves: 100, pads: [...s.pads].reverse().map((p, i) => ({ ...p, id: String(i) })) }));
  });
  it('distinguishes unreachable and budget exceeded', () => {
    const l = fixture([]);
    expect(solveFromState(l, createInitialState(l)).status).toBe('unreachable');
    expect(solveFromState(levels[0], createInitialState(levels[0]), { maxStates: 1, maxMs: 1000 }).status).toBe('budget_exceeded');
    expect(solveFromState(levels[0], createInitialState(levels[0]), { maxStates: 100, maxMs: -1 }).status).toBe('budget_exceeded');
  });
});
