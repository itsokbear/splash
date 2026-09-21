import type { Cell, GameState, LevelDefinition, MoveResult } from '../core/types';
import { createInitialState, isLegalTarget, same, simulateMove } from '../core/rules';
export class GameSession {
  state: GameState;
  history: GameState[] = [];
  selected: Cell | null = null;
  busy = false;
  revision = 0;
  constructor(public level: LevelDefinition) { this.state = createInitialState(level); }
  invalidate() { this.revision++; this.selected = null; }
  select(target: Cell): MoveResult | null {
    if (this.busy) return null;
    if (!isLegalTarget(this.level, this.state, target)) { this.selected = null; return null; }
    if (!this.selected || !same(this.selected, target)) { this.selected = target; return null; }
    const result = simulateMove(this.level, this.state, target);
    if (result.ok) { this.history.push(this.state); this.state = result.next; this.busy = true; this.invalidate(); }
    return result;
  }
  undo(): boolean {
    if (this.busy || !this.history.length) return false;
    this.state = this.history.pop()!; this.invalidate(); return true;
  }
  restart(): boolean {
    if (this.busy) return false;
    this.state = createInitialState(this.level); this.history = []; this.invalidate(); return true;
  }
  changeLevel(level: LevelDefinition) {
    this.busy = false; this.level = level; this.restart();
  }
}
