// Entity lifecycle animations keyed to WALL CLOCK, not game ticks (setInterval drifts and the
// tick rate changes with game speed). The tracker diffs placed[] between state changes: new ids
// get a drop-in animation, gpu-count increases flash the rack, removed ids leave a dust puff.
// The first sync after load registers everything silently so a restored save doesn't re-animate.

import type { GameState } from "../../../game/types";

export const BORN_MS = 480;
export const INSTALL_MS = 420;
export const REMOVE_MS = 420;

export interface InstallFx {
  rackId: string;
  at: number;
}

export interface RemoveFx {
  col: number;
  row: number;
  at: number;
}

export class AnimTracker {
  private born = new Map<string, number>();
  private gpus = new Map<string, number>();
  private pos = new Map<string, { col: number; row: number }>();
  private seeded = false;
  installs: InstallFx[] = [];
  removals: RemoveFx[] = [];

  sync(state: GameState, now: number): void {
    const seen = new Set<string>();
    for (const p of state.placed) {
      seen.add(p.id);
      this.pos.set(p.id, { col: p.col, row: p.row });
      if (!this.born.has(p.id)) this.born.set(p.id, this.seeded ? now : -1e12);
      const g = p.gpus ?? 0;
      const prev = this.gpus.get(p.id);
      if (this.seeded && prev !== undefined && g > prev) this.installs.push({ rackId: p.id, at: now });
      this.gpus.set(p.id, g);
    }
    for (const id of [...this.born.keys()]) {
      if (seen.has(id)) continue;
      const at = this.pos.get(id);
      if (this.seeded && at) this.removals.push({ col: at.col, row: at.row, at: now });
      this.born.delete(id);
      this.gpus.delete(id);
      this.pos.delete(id);
    }
    this.seeded = true;
  }

  /** ms since the entity appeared, or null once the drop-in animation is over. */
  bornT(id: string, now: number): number | null {
    const b = this.born.get(id);
    if (b === undefined) return null;
    const t = now - b;
    return t >= 0 && t < BORN_MS ? t : null;
  }

  /** ms since the most recent GPU install into this rack, or null. */
  installT(rackId: string, now: number): number | null {
    for (let i = this.installs.length - 1; i >= 0; i--) {
      const f = this.installs[i];
      if (f.rackId === rackId) {
        const t = now - f.at;
        return t < INSTALL_MS ? t : null;
      }
    }
    return null;
  }

  prune(now: number): void {
    this.installs = this.installs.filter((f) => now - f.at < INSTALL_MS);
    this.removals = this.removals.filter((f) => now - f.at < REMOVE_MS);
  }
}
