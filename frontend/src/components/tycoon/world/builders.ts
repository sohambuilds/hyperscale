// Build crew — tiny technician figures, one per builder. Each frame, builder i is assigned to
// the i-th under-construction job (the rest idle near the staging area on the apron), eased
// toward its target. At a site it plays a hammering animation with spark flecks. This is the
// "humans on site" layer (the CoC builder made literal); positions live here, jobs come from
// state, all wall-clock.

import type { Placed } from "../../../game/types";
import type { Point } from "../../../iso";
import { drawPerson, type Actor } from "./figures";
import { type Palette } from "./palette";
import { ROWS, projectF, tileCenter } from "./projection";

const STAGING: Point = projectF(-1.4, ROWS - 0.5); // crew break area on the front-left apron

interface Agent {
  x: number;
  y: number;
  px: number; // previous x — derive facing from travel direction
  phase: number; // desync hammering / bob
  walking: boolean;
}

export class BuilderSystem {
  private agents: Agent[] = [];
  readonly reduced: boolean =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  private idleSpot(i: number): Point {
    // fan the idle crew out around the staging area
    const a = i * 1.9;
    return { x: STAGING.x + Math.cos(a) * (10 + (i % 3) * 5), y: STAGING.y + Math.sin(a) * 5 };
  }

  private target(i: number, jobs: Placed[]): { p: Point; working: boolean } {
    if (i < jobs.length) {
      const c = tileCenter(jobs[i].col, jobs[i].row);
      return { p: { x: c.x - 11, y: c.y + 7 }, working: true }; // stand just in front of the site
    }
    return { p: this.idleSpot(i), working: false };
  }

  /** total = build-crew size; jobs = under-construction placeables (oldest first). */
  update(dt: number, jobs: Placed[], total: number, now: number): void {
    while (this.agents.length < total) {
      const sp = this.idleSpot(this.agents.length);
      this.agents.push({ x: sp.x, y: sp.y, px: sp.x, phase: this.agents.length * 1.7, walking: false });
    }
    if (this.agents.length > total) this.agents.length = total;

    const k = Math.min(1, dt / 170);
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const { p } = this.target(i, jobs);
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      a.walking = Math.hypot(dx, dy) > 1.5;
      a.px = a.x;
      a.x += dx * k;
      a.y += dy * k;
      void now;
    }
  }

  /** Emit one depth-sortable actor per builder (the scene interleaves them with buildings). */
  actors(pal: Palette, jobs: Placed[], now: number): Actor[] {
    return this.agents.map((a, i) => {
      const working = i < jobs.length && !a.walking;
      const facing = working ? 1 : a.x >= a.px ? 1 : -1; // face the site while hammering
      return {
        y: a.y,
        render: (ctx: CanvasRenderingContext2D) =>
          drawPerson(ctx, a.x, a.y, {
            hat: pal.amber,
            vest: pal.orange,
            skin: "#e0b489",
            now,
            phase: a.phase,
            walking: a.walking,
            reduced: this.reduced,
            facing,
            action: working ? "hammer" : null,
          }),
      };
    });
  }
}
