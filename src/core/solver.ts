import type { Cell, GameState, LevelDefinition } from './types';
import { getLegalTargets, simulateMove } from './rules';
export interface SearchBudget { maxStates: number; maxMs: number }
export type SolveResult = { status: 'solved'; path: Cell[]; visited: number } | { status: 'unreachable' | 'budget_exceeded'; visited: number };
export function getStateKey(l: LevelDefinition, s: GameState): string {
  return `1:${l.id}:${s.frog.join(',')}:${s.pads.map(p => p.at).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(c => c.join(',')).join(';')}`;
}
export function solveFromState(l: LevelDefinition, start: GameState, budget: SearchBudget = { maxStates: 50_000, maxMs: 1000 }): SolveResult {
  const started = performance.now();
  const nodes: { state: GameState; parent: number; target: Cell | null }[] = [{ state: start, parent: -1, target: null }];
  const seen = new Set([getStateKey(l, start)]);
  for (let head = 0; head < nodes.length; head++) {
    const node = nodes[head];
    if (node.state.status === 'won') {
      const path: Cell[] = [];
      let i = head;
      while (nodes[i].parent !== -1) { path.push(nodes[i].target!); i = nodes[i].parent; }
      return { status: 'solved', path: path.reverse(), visited: seen.size };
    }
    if (performance.now() - started > budget.maxMs) return { status: 'budget_exceeded', visited: seen.size };
    for (const target of getLegalTargets(l, node.state)) {
      const result = simulateMove(l, node.state, target);
      if (!result.ok) continue;
      const key = getStateKey(l, result.next);
      if (seen.has(key)) continue;
      if (seen.size >= budget.maxStates) return { status: 'budget_exceeded', visited: seen.size };
      seen.add(key); nodes.push({ state: result.next, parent: head, target });
    }
  }
  return { status: 'unreachable', visited: seen.size };
}
