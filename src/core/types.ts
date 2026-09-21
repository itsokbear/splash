export type Cell = readonly [number, number];
export type Pad = Readonly<{ id: string; at: Cell }>;
export interface LevelDefinition {
  readonly id: string; readonly title: string; readonly width: number; readonly height: number;
  readonly start: Cell; readonly goal: Cell; readonly land: readonly Cell[];
  readonly rocks: readonly Cell[]; readonly pads: readonly Pad[];
  readonly optimalMoves: number; readonly referenceSolution: readonly Cell[];
}
export interface GameState {
  readonly frog: Cell; readonly pads: readonly Pad[]; readonly moves: number;
  readonly status: 'playing' | 'won';
}
export type BlockReason = 'boundary' | 'land' | 'rock' | 'pad';
export interface WaveAttempt {
  readonly padId: string; readonly from: Cell; readonly to: Cell;
  readonly blockedBy: BlockReason | null;
}
export type MoveResult = { readonly ok: false; readonly reason: string } | {
  readonly ok: true; readonly next: GameState;
  readonly jump: { readonly from: Cell; readonly to: Cell }; readonly wave: readonly WaveAttempt[];
};
