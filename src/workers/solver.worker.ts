import { solveFromState } from '../core/solver';
import type { GameState, LevelDefinition } from '../core/types';
self.onmessage = (event: MessageEvent<{ revision: number; level: LevelDefinition; state: GameState }>) => {
  const { revision, level, state } = event.data;
  self.postMessage({ revision, result: solveFromState(level, state) });
};
