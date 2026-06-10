// Particle/feedback systems drawn in WORLD space: request packets streaming from the uplink to
// serving racks (density ∝ served req/s), floating "+$N"/"SLA!" text from state.fx, and breach
// rings. state.fx is REPLACED wholesale each tick (not accumulated), so consumption dedupes by
// FxItem.id high-water mark. All motion runs on wall-clock dt.

import type { Point } from "../../../iso";
import type { GameState, Placed } from "../../../game/types";
import { withAlpha, type Palette } from "./palette";
import { UPLINK_GAP, tileCenter } from "./projection";

const PACKET_CAP = 200;

interface Packet {
  from: Point;
  to: Point;
  cp: Point;
  t: number;
  dur: number;
}

interface Mote {
  x: number;
  y: number;
  t: number;
  dur: number;
  text: string;
  bad: boolean;
}

interface Ring {
  x: number;
  y: number;
  t: number;
  dur: number;
}

export class FxSystem {
  private packets: Packet[] = [];
  private motes: Mote[] = [];
  private rings: Ring[] = [];
  private lastFxId = 0;
  private acc = 0;
  readonly reduced: boolean =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Consume new FxItems (dedupe by id — the engine re-emits a fresh array every tick). */
  syncGameFx(state: GameState): void {
    for (const f of state.fx) {
      if (f.id <= this.lastFxId) continue;
      this.lastFxId = f.id;
      const rack = state.placed.find((p) => p.id === f.rackId);
      if (!rack) continue;
      const c = tileCenter(rack.col, rack.row);
      if (f.kind === "cash") {
        this.motes.push({ x: c.x, y: c.y - 42, t: 0, dur: 1150, text: f.text, bad: false });
      } else {
        this.motes.push({ x: c.x, y: c.y - 48, t: 0, dur: 1150, text: f.text, bad: true });
        this.rings.push({ x: c.x, y: c.y, t: 0, dur: 650 });
      }
    }
  }

  /** A one-off dust puff (sell/remove). Reuses the ring visual at low alpha. */
  puff(col: number, row: number): void {
    const c = tileCenter(col, row);
    this.rings.push({ x: c.x, y: c.y, t: 0, dur: 420 });
  }

  update(dt: number, servedRps: number, racks: Placed[]): void {
    if (!this.reduced && racks.length > 0 && servedRps > 0.5) {
      const rate = Math.min(26, 2 + servedRps / 8); // packets/sec — a feel, not a unit
      this.acc = Math.min(this.acc + (dt / 1000) * rate, 3);
      const totalW = racks.reduce((a, r) => a + (r.gpus ?? 0), 0) || 1;
      while (this.acc >= 1 && this.packets.length < PACKET_CAP) {
        this.acc -= 1;
        let pick = Math.random() * totalW;
        let target = racks[0];
        for (const r of racks) {
          pick -= r.gpus ?? 0;
          if (pick <= 0) {
            target = r;
            break;
          }
        }
        const to = tileCenter(target.col, target.row);
        const mid = {
          x: (UPLINK_GAP.x + to.x) / 2,
          y: (UPLINK_GAP.y + to.y) / 2 - 24 - Math.random() * 16,
        };
        this.packets.push({
          from: UPLINK_GAP,
          to: { x: to.x + (Math.random() - 0.5) * 12, y: to.y + (Math.random() - 0.5) * 6 },
          cp: mid,
          t: 0,
          dur: 600 + Math.random() * 260,
        });
      }
    } else {
      this.acc = 0;
    }
    for (const p of this.packets) p.t += dt;
    for (const m of this.motes) m.t += dt;
    for (const r of this.rings) r.t += dt;
    this.packets = this.packets.filter((p) => p.t < p.dur);
    this.motes = this.motes.filter((m) => m.t < m.dur);
    this.rings = this.rings.filter((r) => r.t < r.dur);
  }

  draw(ctx: CanvasRenderingContext2D, pal: Palette): void {
    // packets: bright head + two trail ghosts along a quadratic arc
    for (const p of this.packets) {
      const u = p.t / p.dur;
      for (let k = 0; k < 3; k++) {
        const uu = Math.max(0, u - k * 0.05);
        const x = (1 - uu) * (1 - uu) * p.from.x + 2 * (1 - uu) * uu * p.cp.x + uu * uu * p.to.x;
        const y = (1 - uu) * (1 - uu) * p.from.y + 2 * (1 - uu) * uu * p.cp.y + uu * uu * p.to.y;
        ctx.fillStyle = withAlpha(pal.cyan, k === 0 ? 0.95 : 0.3 / k);
        const s = k === 0 ? 2.2 : 1.6;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    // breach/sell rings: expanding iso ellipse
    for (const r of this.rings) {
      const u = r.t / r.dur;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(1, 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, 6 + u * 26, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(pal.red, 0.7 * (1 - u));
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
    // floating text
    ctx.font = "700 9px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    for (const m of this.motes) {
      const u = m.t / m.dur;
      const alpha = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
      ctx.fillStyle = withAlpha(m.bad ? pal.red : pal.green, Math.max(0, alpha));
      ctx.fillText(m.text, m.x, m.y - u * 16);
    }
    ctx.textAlign = "start";
  }
}
