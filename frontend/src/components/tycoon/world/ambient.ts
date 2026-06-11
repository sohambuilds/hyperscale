// The world's mood layer: a cached twilight sky (indigo→violet→teal, stars, nebula, a distant
// neon city) drawn in SCREEN space behind everything, plus WORLD-space dressing — floating rock
// shards under the island and patrol drones above it. Everything animated is wall-clock and
// suppressed under prefers-reduced-motion (static sky still draws).

import type { Point } from "../../../iso";
import { withAlpha, type Palette } from "./palette";
import { COLS, HH, HW, ROWS, projectF } from "./projection";

interface Star {
  x: number; // 0..1 of viewport
  y: number;
  r: number;
  a: number;
  tw: number; // twinkle phase (0 = static)
}

interface Shard {
  p: Point; // world anchor (projected, already depth-offset)
  s: number; // size as a fraction of a tile
  ph: number; // bob phase
}

interface Drone {
  rx: number;
  ry: number;
  sp: number;
  ph: number;
}

export class AmbientSystem {
  readonly reduced: boolean =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  private sky: HTMLCanvasElement | null = null;
  private skyW = 0;
  private skyH = 0;
  private twinklers: Star[] = [];

  private shards: Shard[] = [];
  private drones: Drone[] = [];
  private center: Point;

  constructor() {
    this.center = projectF((COLS - 1) / 2, (ROWS - 1) / 2);
    // floating rock shards ringing the island, below its plane
    const spots: Array<[number, number, number, number]> = [
      [-3.6, ROWS * 0.72, 0.34, 52],
      [COLS * 0.42, ROWS + 2.9, 0.42, 74],
      [COLS + 2.8, ROWS * 0.48, 0.3, 60],
      [COLS * 0.82, -3.4, 0.26, 44],
      [-2.9, ROWS + 2.1, 0.24, 64],
      [COLS + 2.1, ROWS + 1.5, 0.36, 88],
    ];
    this.shards = spots.map(([c, r, s, depth], i) => {
      const p = projectF(c, r);
      return { p: { x: p.x, y: p.y + depth }, s, ph: i * 1.83 };
    });
    this.drones = [
      { rx: COLS * HW * 0.52, ry: ROWS * HH * 0.95, sp: 1 / 14000, ph: 0.4 },
      { rx: COLS * HW * 0.34, ry: ROWS * HH * 0.7, sp: -1 / 11000, ph: 2.6 },
    ];
  }

  // --- screen-space sky -----------------------------------------------------------------------

  private buildSky(vw: number, vh: number): void {
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, vw);
    cv.height = Math.max(1, vh);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const horizon = vh * 0.58;

    // twilight gradient: deep indigo up top → violet → a teal glow at the horizon → abyss below
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, "#0f0c38");
    g.addColorStop(0.34, "#251260");
    g.addColorStop(0.55, "#1c2a72");
    g.addColorStop(0.62, "#11486e");
    g.addColorStop(0.78, "#0c1440");
    g.addColorStop(1, "#080a24");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // nebula blooms
    const blob = (x: number, y: number, r: number, color: string): void => {
      const ng = ctx.createRadialGradient(x, y, 0, x, y, r);
      ng.addColorStop(0, color);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ng;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(vw * 0.18, vh * 0.16, vh * 0.4, "rgba(168,85,247,0.10)");
    blob(vw * 0.78, vh * 0.1, vh * 0.36, "rgba(236,72,153,0.07)");
    blob(vw * 0.55, vh * 0.34, vh * 0.5, "rgba(45,212,191,0.05)");

    // horizon glow band
    const hg = ctx.createLinearGradient(0, horizon - vh * 0.1, 0, horizon + vh * 0.06);
    hg.addColorStop(0, "rgba(34,211,238,0)");
    hg.addColorStop(0.7, "rgba(34,211,238,0.13)");
    hg.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - vh * 0.1, vw, vh * 0.16);

    // static starfield above the horizon (twinklers are drawn live)
    this.twinklers = [];
    const n = Math.round((vw * vh) / 14000);
    for (let i = 0; i < n; i++) {
      const x = Math.random();
      const y = Math.random() * 0.55;
      const r = 0.4 + Math.random() * 1.1;
      const a = 0.25 + Math.random() * 0.6;
      const hue = Math.random();
      const col = hue < 0.72 ? "255,255,255" : hue < 0.88 ? "140,225,255" : "252,211,150";
      if (i % 7 === 0) {
        this.twinklers.push({ x, y, r: r + 0.3, a, tw: 1 + Math.random() * 2 });
        continue;
      }
      ctx.fillStyle = `rgba(${col},${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x * vw, y * vh, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // distant neon city along the horizon, two parallax bands
    const skyline = (yBase: number, h0: number, tone: string, litEvery: number): void => {
      let x = -10;
      let i = 0;
      while (x < vw + 20) {
        const w = 14 + ((i * 37) % 26);
        const h = h0 * (0.45 + ((i * 53) % 100) / 130);
        ctx.fillStyle = tone;
        ctx.fillRect(x, yBase - h, w, h);
        if (i % litEvery === 0) {
          // a few lit windows
          for (let k = 0; k < 4; k++) {
            const wx = x + 2 + ((i * 11 + k * 17) % Math.max(2, w - 4));
            const wy = yBase - h + 3 + ((i * 7 + k * 29) % Math.max(2, h - 6));
            const c = k % 3 === 0 ? "252,211,77" : k % 3 === 1 ? "94,232,255" : "244,114,182";
            ctx.fillStyle = `rgba(${c},0.55)`;
            ctx.fillRect(wx, wy, 1.2, 1.6);
          }
        }
        x += w + 3;
        i++;
      }
    };
    skyline(horizon + 2, vh * 0.075, "rgba(22,26,74,0.85)", 2);
    skyline(horizon + 4, vh * 0.045, "rgba(15,18,56,0.95)", 3);

    this.sky = cv;
    this.skyW = vw;
    this.skyH = vh;
  }

  /** Backdrop: cached sky + live twinkles + aurora ribbons. Call before the camera transform. */
  drawSky(ctx: CanvasRenderingContext2D, vw: number, vh: number, now: number): void {
    if (!this.sky || Math.abs(vw - this.skyW) > 1 || Math.abs(vh - this.skyH) > 1) this.buildSky(vw, vh);
    if (this.sky) ctx.drawImage(this.sky, 0, 0, vw, vh);

    // twinkling stars
    for (const s of this.twinklers) {
      const a = this.reduced ? s.a : s.a * (0.45 + 0.55 * Math.abs(Math.sin(now / 900 * s.tw + s.tw * 9)));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x * vw, s.y * vh, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // aurora ribbons drifting across the upper sky
    const ribbon = (yBase: number, amp: number, color: string, speed: number, ph: number): void => {
      ctx.beginPath();
      for (let x = 0; x <= vw; x += 24) {
        const t = this.reduced ? 0 : now * speed;
        const y = yBase + Math.sin(x / 170 + t + ph) * amp + Math.sin(x / 61 - t * 0.7) * amp * 0.3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 26;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    ribbon(vh * 0.16, 14, "rgba(45,212,191,0.045)", 1 / 4200, 0);
    ribbon(vh * 0.24, 18, "rgba(192,132,252,0.04)", 1 / 5400, 2.2);
  }

  // --- world-space dressing ---------------------------------------------------------------------

  /** Floating platform slabs below the island plane — small drifting "service pads". */
  drawBelow(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
    for (const sh of this.shards) {
      const bob = this.reduced ? 0 : Math.sin(now / 1900 + sh.ph) * 3.2;
      const cx = sh.p.x;
      const cy = sh.p.y + bob;
      const w = HW * sh.s;
      const h = HH * sh.s;
      const depth = Math.max(3, w * 0.32); // flat slab, not a spike
      const top: Point[] = [
        { x: cx, y: cy - h },
        { x: cx + w, y: cy },
        { x: cx, y: cy + h },
        { x: cx - w, y: cy },
      ];
      // slab sides
      ctx.fillStyle = "#171c4d";
      ctx.beginPath();
      ctx.moveTo(top[3].x, top[3].y);
      ctx.lineTo(top[2].x, top[2].y);
      ctx.lineTo(top[2].x, top[2].y + depth);
      ctx.lineTo(top[3].x, top[3].y + depth);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#11153c";
      ctx.beginPath();
      ctx.moveTo(top[2].x, top[2].y);
      ctx.lineTo(top[1].x, top[1].y);
      ctx.lineTo(top[1].x, top[1].y + depth);
      ctx.lineTo(top[2].x, top[2].y + depth);
      ctx.closePath();
      ctx.fill();
      // top face + glowing edge seam
      ctx.fillStyle = "#262d6e";
      ctx.beginPath();
      ctx.moveTo(top[0].x, top[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(top[i].x, top[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(pal.cyan, 0.28);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // a blinking service light on the bigger pads
      if (sh.s > 0.3) {
        const on = this.reduced ? 0.5 : 0.3 + 0.6 * ((Math.sin(now / 800 + sh.ph) + 1) / 2);
        ctx.fillStyle = withAlpha(pal.gold, on);
        ctx.beginPath();
        ctx.arc(cx + w * 0.4, cy - h * 0.3, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Patrol drones above the island. Call inside the camera transform, after entities. */
  drawAbove(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
    if (this.reduced) return;
    for (const d of this.drones) {
      const t = now * d.sp + d.ph;
      const x = this.center.x + Math.cos(t) * d.rx;
      const y = this.center.y + Math.sin(t * 0.9) * d.ry * 0.5 - 116 + Math.sin(now / 1300 + d.ph) * 4;
      // motion trail ghosts
      for (let k = 3; k >= 1; k--) {
        const tt = t - k * 0.05;
        const gx = this.center.x + Math.cos(tt) * d.rx;
        const gy = this.center.y + Math.sin(tt * 0.9) * d.ry * 0.5 - 116;
        ctx.fillStyle = withAlpha(pal.cyan, 0.05 * (4 - k));
        ctx.beginPath();
        ctx.arc(gx, gy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // body + rotors
      ctx.fillStyle = "#222b66";
      ctx.beginPath();
      ctx.ellipse(x, y, 3.6, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(pal.cyan, 0.4);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      const spin = 0.4 + 0.6 * Math.abs(Math.sin(now / 90 + d.ph));
      ctx.fillStyle = withAlpha(pal.cyanHi, spin * 0.6);
      for (const [ox, oy] of [
        [-4.4, -1.4],
        [4.4, -1.4],
        [-3.2, 1.6],
        [3.2, 1.6],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      // nav lights
      const blink = Math.sin(now / 480 + d.ph) > 0.2;
      ctx.fillStyle = withAlpha(pal.red, blink ? 0.9 : 0.15);
      ctx.fillRect(x - 4.6, y - 0.6, 1.1, 1.1);
      ctx.fillStyle = withAlpha(pal.green, blink ? 0.15 : 0.9);
      ctx.fillRect(x + 3.6, y - 0.6, 1.1, 1.1);
      // soft underglow
      const ug = ctx.createRadialGradient(x, y + 6, 0, x, y + 6, 10);
      ug.addColorStop(0, "rgba(94,232,255,0.10)");
      ug.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ug;
      ctx.fillRect(x - 10, y - 4, 20, 20);
    }
  }
}
