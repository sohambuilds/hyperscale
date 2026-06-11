// Ambient floor staff — datacenter technicians strolling the aisles between buildings. Each one
// BFS-paths through UNOCCUPIED tiles to a random empty destination (so they route around buildings
// down the aisles, never clipping through a footprint), pauses on arrival (often pulling out a
// tablet to "inspect" an adjacent rack), then heads off again. Pure flavor: no game-state changes,
// drawn on top of the world inside the camera transform, frozen under reduced-motion.

import type { Placed } from "../../../game/types";
import { drawPerson, roleStyle, type Actor } from "./figures";
import type { Palette } from "./palette";
import { COLS, ROWS, tileCenter } from "./projection";

interface Tile {
  col: number;
  row: number;
}

interface Walker {
  col: number; // current tile (last reached)
  row: number;
  x: number; // world pos
  y: number;
  px: number; // previous x — facing
  path: Tile[]; // remaining tiles to walk through (excludes current)
  speed: number; // world px/sec
  phase: number;
  role: number;
  action: "inspect" | null;
  pause: number; // ms standing still
}

const COUNT = 6;
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const tkey = (c: number, r: number): number => c * 100 + r;

export class PedestrianSystem {
  private ws: Walker[] = [];
  private seeded = false;
  readonly reduced: boolean =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  private blockedSet(placed: Placed[]): Set<number> {
    const s = new Set<number>();
    for (const p of placed) s.add(tkey(p.col, p.row));
    return s;
  }

  private randEmptyTile(blocked: Set<number>): Tile | null {
    for (let tries = 0; tries < 12; tries++) {
      const col = Math.floor(Math.random() * COLS);
      const row = Math.floor(Math.random() * ROWS);
      if (!blocked.has(tkey(col, row))) return { col, row };
    }
    return null;
  }

  /** Shortest tile path from→to through unblocked tiles (8-dir, no corner-cutting). Excludes `from`. */
  private bfs(from: Tile, to: Tile, blocked: Set<number>): Tile[] | null {
    const fk = tkey(from.col, from.row);
    const tk = tkey(to.col, to.row);
    if (fk === tk) return [];
    if (blocked.has(tk)) return null;
    const q: number[] = [fk];
    const seen = new Set<number>([fk]);
    const prev = new Map<number, number>();
    let head = 0;
    while (head < q.length) {
      const ck = q[head++];
      const cc = Math.floor(ck / 100);
      const cr = ck % 100;
      for (const [dc, dr] of DIRS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const nk = nc * 100 + nr;
        if (seen.has(nk) || blocked.has(nk)) continue;
        if (dc !== 0 && dr !== 0 && (blocked.has(tkey(cc + dc, cr)) || blocked.has(tkey(cc, cr + dr)))) continue;
        seen.add(nk);
        prev.set(nk, ck);
        if (nk === tk) {
          const out: Tile[] = [];
          let k = tk;
          while (k !== fk) {
            out.push({ col: Math.floor(k / 100), row: k % 100 });
            k = prev.get(k)!;
          }
          return out.reverse();
        }
        q.push(nk);
      }
    }
    return null; // walled off
  }

  private repath(w: Walker, blocked: Set<number>): void {
    for (let tries = 0; tries < 5; tries++) {
      const dest = this.randEmptyTile(blocked);
      if (!dest) break;
      const path = this.bfs({ col: w.col, row: w.row }, dest, blocked);
      if (path && path.length) {
        w.path = path;
        return;
      }
    }
    w.path = [];
    w.pause = 500 + Math.random() * 1200; // boxed in for the moment — wait and retry
  }

  update(dt: number, placed: Placed[], now: number): void {
    void now;
    const blocked = this.blockedSet(placed);

    if (!this.seeded) {
      for (let i = 0; i < COUNT; i++) {
        const start = this.randEmptyTile(blocked) ?? { col: 0, row: 0 };
        const c = tileCenter(start.col, start.row);
        this.ws.push({ col: start.col, row: start.row, x: c.x, y: c.y, px: c.x, path: [], speed: 11 + Math.random() * 8, phase: i * 1.3, role: i, action: null, pause: Math.random() * 1500 });
      }
      this.seeded = true;
    }
    if (this.reduced) return; // staff hold position under reduced-motion

    for (const w of this.ws) {
      if (w.pause > 0) {
        w.pause -= dt;
        continue;
      }
      // a building appeared on the planned route → recompute
      if (w.path.some((t) => blocked.has(tkey(t.col, t.row)))) w.path = [];
      if (w.path.length === 0) {
        this.repath(w, blocked);
        if (w.path.length === 0) continue;
      }
      const next = w.path[0];
      const c = tileCenter(next.col, next.row);
      const dx = c.x - w.x;
      const dy = c.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d < 1.2) {
        w.col = next.col;
        w.row = next.row;
        w.path.shift();
        if (w.path.length === 0) {
          // arrived at destination: pause, and inspect if standing next to a building
          w.pause = 700 + Math.random() * 2000;
          const adjacent = DIRS.some(([dc, dr]) => blocked.has(tkey(w.col + dc, w.row + dr)));
          w.action = adjacent && Math.random() < 0.7 ? "inspect" : null;
        }
        continue;
      }
      const step = Math.min(1, (w.speed * dt) / 1000 / d);
      w.px = w.x;
      w.x += dx * step;
      w.y += dy * step;
      w.action = null;
    }
  }

  /** Emit one depth-sortable actor per technician (the scene interleaves them with buildings). */
  actors(pal: Palette, now: number): Actor[] {
    return this.ws.map((w) => {
      const walking = w.pause <= 0 && w.path.length > 0;
      return {
        y: w.y,
        render: (ctx: CanvasRenderingContext2D) =>
          drawPerson(ctx, w.x, w.y, {
            ...roleStyle(pal, w.role),
            now,
            phase: w.phase,
            walking,
            reduced: this.reduced,
            facing: w.x >= w.px ? 1 : -1,
            action: walking ? null : w.action,
          }),
      };
    });
  }
}
