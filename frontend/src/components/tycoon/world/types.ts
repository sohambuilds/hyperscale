// Shared types crossing the React ↔ canvas boundary.

import type { GameState, Stats } from "../../../game/types";

/** Written by TycoonGame on every React render; read by the rAF loop via ref. */
export interface FrameData {
  state: GameState;
  stats: Stats;
}

export interface HoverTile {
  col: number;
  row: number;
}
