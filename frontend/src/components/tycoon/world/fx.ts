// Particle/feedback systems drawn in WORLD space: request packets streaming from the uplink to
// serving racks (density ∝ served req/s), energy pulses running power→racks along the floor,
// gold earn-motes rising off serving racks, completion celebrations (light pillar + ring + spark
// fountain in the building's identity color), floating "+$N"/"SLA!" text, and breach rings.
// state.fx is REPLACED wholesale each tick (not accumulated), so consumption dedupes by FxItem.id
// high-water mark. All motion runs on wall-clock dt; spawning is suppressed under reduced-motion.

import type { Point } from "../../../iso";
import type { GameState, Placed, PlaceableKind } from "../../../game/types";
import { withAlpha, type Palette } from "./palette";
import { UPLINK_GAP, tileCenter } from "./projection";

const PACKET_CAP = 200;
const PULSE_CAP = 8;
const COIN_CAP = 36;

interface Packet {
  from: Point;
  to: Point;
  cp: Point;
  t: number;
  dur: number;
  gold: boolean;
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

interface Pulse {
  a: Point;
  b: Point; // corner of the L-path
  c: Point;
  t: number;
  dur: number;
}

interface Coin {
  x: number;
  y: number;
  sway: number;
  t: number;
  dur: number;
}

interface Burst {
  x: number;
  y: number;
  kind: PlaceableKind;
  t: number;
  dur: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: PlaceableKind;
  t: number;
  dur: number;
}

/** Identity color per building kind — matches the sprites. */
export function kindColor(pal: Palette, kind: PlaceableKind): string {
  switch (kind) {
    case "power":
      return pal.gold;
    case "cooling":
      return pal.teal;
    case "network":
      return pal.magenta;
    case "crewpod":
      return pal.orange;
    default:
      return pal.cyanHi; // rack
  }
}

export class FxSystem {
  private packets: Packet[] = [];
  private motes: Mote[] = [];
  private rings: Ring[] = [];
  private pulses: Pulse[] = [];
  private coins: Coin[] = [];
  private bursts: Burst[] = [];
  private sparks: Spark[] = [];
  private lastFxId = 0;
  private acc = 0;
  private pulseAcc = 0;
  private coinAcc = 0;
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

  /** Construction-complete ceremony: light pillar + identity ring + spark fountain. */
  celebrate(col: number, row: number, kind: PlaceableKind): void {
    const c = tileCenter(col, row);
    this.bursts.push({ x: c.x, y: c.y, kind, t: 0, dur: 900 });
    if (this.reduced) return;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 16 + Math.random() * 38;
      this.sparks.push({
        x: c.x,
        y: c.y - 6,
        vx: Math.cos(a) * sp,
        vy: -32 - Math.random() * 46 + Math.sin(a) * sp * 0.3,
        kind,
        t: 0,
        dur: 620 + Math.random() * 380,
      });
    }
  }

  update(dt: number, servedRps: number, racks: Placed[], powers: Placed[]): void {
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
          gold: Math.random() < 0.07, // the occasional "premium" request
        });
      }

      // energy pulses: power → a serving rack along an L-shaped floor path
      this.pulseAcc += dt;
      if (powers.length > 0 && this.pulseAcc > 640 && this.pulses.length < PULSE_CAP) {
        this.pulseAcc = 0;
        const pw = powers[Math.floor(Math.random() * powers.length)];
        const rk = racks[Math.floor(Math.random() * racks.length)];
        this.pulses.push({
          a: tileCenter(pw.col, pw.row),
          b: tileCenter(rk.col, pw.row),
          c: tileCenter(rk.col, rk.row),
          t: 0,
          dur: 800,
        });
      }

      // gold earn-motes drifting up from serving racks
      this.coinAcc = Math.min(this.coinAcc + (dt / 1000) * Math.min(5, 1 + servedRps / 60), 2);
      while (this.coinAcc >= 1 && this.coins.length < COIN_CAP) {
        this.coinAcc -= 1;
        const r = racks[Math.floor(Math.random() * racks.length)];
        const c = tileCenter(r.col, r.row);
        this.coins.push({
          x: c.x + (Math.random() - 0.5) * 14,
          y: c.y - 30 - Math.random() * 8,
          sway: Math.random() * Math.PI * 2,
          t: 0,
          dur: 1000 + Math.random() * 400,
        });
      }
    } else {
      this.acc = 0;
      this.coinAcc = 0;
    }
    for (const p of this.packets) p.t += dt;
    for (const m of this.motes) m.t += dt;
    for (const r of this.rings) r.t += dt;
    for (const p of this.pulses) p.t += dt;
    for (const c of this.coins) c.t += dt;
    for (const b of this.bursts) b.t += dt;
    for (const s of this.sparks) {
      s.t += dt;
      s.x += (s.vx * dt) / 1000;
      s.y += (s.vy * dt) / 1000;
      s.vy += (90 * dt) / 1000; // gravity
    }
    this.packets = this.packets.filter((p) => p.t < p.dur);
    this.motes = this.motes.filter((m) => m.t < m.dur);
    this.rings = this.rings.filter((r) => r.t < r.dur);
    this.pulses = this.pulses.filter((p) => p.t < p.dur);
    this.coins = this.coins.filter((c) => c.t < c.dur);
    this.bursts = this.bursts.filter((b) => b.t < b.dur);
    this.sparks = this.sparks.filter((s) => s.t < s.dur);
  }

  draw(ctx: CanvasRenderingContext2D, pal: Palette): void {
    // energy pulses along the floor: bright gold head + fading tail on an L-path
    for (const p of this.pulses) {
      const u = p.t / p.dur;
      const l1 = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y);
      const l2 = Math.hypot(p.c.x - p.b.x, p.c.y - p.b.y);
      const total = l1 + l2 || 1;
      const at = (uu: number): Point => {
        const d = uu * total;
        if (d <= l1) {
          const k = l1 === 0 ? 0 : d / l1;
          return { x: p.a.x + (p.b.x - p.a.x) * k, y: p.a.y + (p.b.y - p.a.y) * k };
        }
        const k = l2 === 0 ? 0 : (d - l1) / l2;
        return { x: p.b.x + (p.c.x - p.b.x) * k, y: p.b.y + (p.c.y - p.b.y) * k };
      };
      for (let k = 0; k < 4; k++) {
        const uu = Math.max(0, u - k * 0.045);
        const pos = at(uu);
        ctx.fillStyle = withAlpha(pal.gold, k === 0 ? 0.9 : 0.35 / k);
        const sz = k === 0 ? 2.4 : 1.8;
        ctx.fillRect(pos.x - sz / 2, pos.y - sz / 2, sz, sz);
      }
    }

    // packets: bright head + two trail ghosts along a quadratic arc
    for (const p of this.packets) {
      const u = p.t / p.dur;
      const col = p.gold ? pal.gold : pal.cyan;
      for (let k = 0; k < 3; k++) {
        const uu = Math.max(0, u - k * 0.05);
        const x = (1 - uu) * (1 - uu) * p.from.x + 2 * (1 - uu) * uu * p.cp.x + uu * uu * p.to.x;
        const y = (1 - uu) * (1 - uu) * p.from.y + 2 * (1 - uu) * uu * p.cp.y + uu * uu * p.to.y;
        ctx.fillStyle = withAlpha(col, k === 0 ? 0.95 : 0.3 / k);
        const s = k === 0 ? 2.2 : 1.6;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }

    // gold earn-motes: rising, swaying, twinkling
    for (const c of this.coins) {
      const u = c.t / c.dur;
      const a = (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8) * (0.55 + 0.45 * Math.sin(c.t / 90 + c.sway));
      ctx.fillStyle = withAlpha(pal.gold, Math.max(0, a));
      const x = c.x + Math.sin(c.t / 240 + c.sway) * 3;
      const y = c.y - u * 22;
      ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    }

    // completion celebrations: light pillar + expanding identity ring
    for (const b of this.bursts) {
      const u = b.t / b.dur;
      const col = kindColor(pal, b.kind);
      if (u < 0.55) {
        const pu = u / 0.55;
        const pw = 9 * (1 - pu) + 1.5;
        const phh = 64 * (0.4 + 0.6 * pu);
        const g = ctx.createLinearGradient(0, b.y - phh, 0, b.y);
        g.addColorStop(0, withAlpha(col, 0));
        g.addColorStop(1, withAlpha(col, 0.5 * (1 - pu)));
        ctx.fillStyle = g;
        ctx.fillRect(b.x - pw / 2, b.y - phh, pw, phh);
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(1, 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, 5 + u * 30, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(col, 0.8 * (1 - u));
      ctx.lineWidth = 2 - u;
      ctx.stroke();
      ctx.restore();
    }

    // celebration sparks
    for (const s of this.sparks) {
      const u = s.t / s.dur;
      ctx.fillStyle = withAlpha(kindColor(pal, s.kind), 0.9 * (1 - u));
      ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
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
      ctx.fillStyle = withAlpha(m.bad ? pal.red : pal.gold, Math.max(0, alpha));
      ctx.fillText(m.text, m.x, m.y - u * 16);
    }
    ctx.textAlign = "start";
  }
}
