// The place itself — now a floating sky-island: luminous platform top, cliff faces with glowing
// crystal veins and an under-glow abyss, a neon perimeter path, the building shell (full-height
// back walls, cutaway front walls — the RCT trick), vibrant raised-floor tiles with a drifting
// light sweep, and the uplink citadel feeding the hall.

import type { Point } from "../../../../iso";
import { heatColor } from "../../../../iso";
import type { GameState } from "../../../../game/types";
import { rackLoad, techPowerMult } from "../../selectors";
import { withAlpha, type Palette } from "../palette";
import {
  APRON,
  COLS,
  HW,
  LOW_WALL_H,
  ROWS,
  UPLINK_GAP,
  UPLINK_POS,
  UPLINK_ROW,
  WALL_H,
  diamond,
  hallCorners,
  pathPoly,
  projectF,
  tileCenter,
} from "../projection";
import { fillPoly, strokePoly } from "./common";

const CLIFF_H = 62;

function apronCorners(pad: number): Point[] {
  return [
    projectF(-0.5 - pad, -0.5 - pad),
    projectF(COLS - 0.5 + pad, -0.5 - pad),
    projectF(COLS - 0.5 + pad, ROWS - 0.5 + pad),
    projectF(-0.5 - pad, ROWS - 0.5 + pad),
  ];
}

/** The floating island: under-glow, cliff faces with crystal veins, platform top, neon ring. */
export function drawApron(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
  const pts = apronCorners(APRON); // [N, E, S, W]
  const [n, e, s, w] = pts;

  // abyss under-glow — sells the "floating" feel
  const ug = ctx.createRadialGradient(s.x, s.y + CLIFF_H * 0.7, 0, s.x, s.y + CLIFF_H * 0.7, (e.x - w.x) * 0.46);
  ug.addColorStop(0, "rgba(34,211,238,0.13)");
  ug.addColorStop(0.55, "rgba(124,58,237,0.07)");
  ug.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ug;
  ctx.fillRect(w.x, n.y, e.x - w.x, s.y - n.y + CLIFF_H * 2.2);

  // cliff faces below the two front edges (E→S and S→W)
  const cliff = (a: Point, b: Point, light: boolean): void => {
    const g = ctx.createLinearGradient(0, Math.min(a.y, b.y), 0, Math.max(a.y, b.y) + CLIFF_H);
    g.addColorStop(0, light ? "#252a66" : "#1c2153");
    g.addColorStop(0.55, light ? "#181c4c" : "#12163e");
    g.addColorStop(1, "#0a0c28");
    fillPoly(ctx, [a, b, { x: b.x, y: b.y + CLIFF_H }, { x: a.x, y: a.y + CLIFF_H }], "#10133a");
    ctx.fillStyle = g;
    pathPoly(ctx, [a, b, { x: b.x, y: b.y + CLIFF_H }, { x: a.x, y: a.y + CLIFF_H }]);
    ctx.fill();
    // strata lines
    ctx.strokeStyle = "rgba(140,170,255,0.06)";
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      const d = (CLIFF_H / 4) * k;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + d);
      ctx.lineTo(b.x, b.y + d);
      ctx.stroke();
    }
    // glowing crystal veins
    for (let i = 0; i < 4; i++) {
      const t = 0.12 + i * 0.24 + Math.sin(i * 7.3 + (light ? 1 : 5)) * 0.04;
      const x0 = a.x + (b.x - a.x) * t;
      const y0 = a.y + (b.y - a.y) * t + 6;
      const col = i % 2 === 0 ? pal.cyan : pal.magenta;
      const pulse = 0.3 + 0.2 * Math.sin(now / 1100 + i * 2.1 + (light ? 0 : 3));
      ctx.strokeStyle = withAlpha(col, pulse);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.sin(i * 97) * 4, y0 + 14);
      ctx.lineTo(x0 + Math.sin(i * 41) * 6, y0 + 27 + (i % 2) * 8);
      ctx.stroke();
    }
  };
  cliff(e, s, true);
  cliff(s, w, false);
  // bottom rim glow along the cliff base
  ctx.strokeStyle = withAlpha(pal.cyan, 0.18 + 0.06 * Math.sin(now / 1500));
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y + CLIFF_H);
  ctx.lineTo(s.x, s.y + CLIFF_H);
  ctx.lineTo(w.x, w.y + CLIFF_H);
  ctx.stroke();

  // platform top
  fillPoly(ctx, pts, "#161b46");
  const lp = ctx.createRadialGradient(s.x, (n.y + s.y) / 2, 0, s.x, (n.y + s.y) / 2, (e.x - w.x) * 0.5);
  lp.addColorStop(0, "rgba(94,140,255,0.06)");
  lp.addColorStop(1, "rgba(0,0,0,0)");
  pathPoly(ctx, pts);
  ctx.fillStyle = lp;
  ctx.fill();
  strokePoly(ctx, pts, "rgba(150,190,255,0.16)", 1.2);

  // neon perimeter path around the hall (marching dashes) + corner nodes
  const ring = apronCorners(0.5);
  ctx.save();
  ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = -(now / 36) % 21;
  ctx.strokeStyle = withAlpha(pal.cyan, 0.4);
  ctx.shadowColor = pal.cyan;
  ctx.shadowBlur = 7;
  ctx.lineWidth = 1.5;
  pathPoly(ctx, ring);
  ctx.stroke();
  ctx.restore();
  for (const p of ring) {
    ctx.fillStyle = withAlpha(pal.gold, 0.75 + 0.2 * Math.sin(now / 800 + p.x));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // landing pad out by the uplink (road → glowing pad)
  const a = projectF(-0.6, UPLINK_ROW - 0.55);
  const b = projectF(-2.6, UPLINK_ROW - 0.55);
  const c = projectF(-2.6, UPLINK_ROW + 0.55);
  const d = projectF(-0.6, UPLINK_ROW + 0.55);
  fillPoly(ctx, [a, b, c, d], "#131a45");
  ctx.setLineDash([3, 5]);
  strokePoly(ctx, [a, b, c, d], withAlpha(pal.gold, 0.4), 1);
  ctx.setLineDash([]);
}

/** Full-height back walls (NW + NE), indigo glass with a neon roofline + the uplink cable gap. */
export function drawBackWalls(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
  const { top, right, left } = hallCorners();
  const up = (p: Point, h: number): Point => ({ x: p.x, y: p.y - h });

  // NW wall (col = -0.5), faces SE (lighter) — per-tile so the uplink gap can be skipped
  for (let r = 0; r < ROWS; r++) {
    if (Math.abs(r + 0.5 - (UPLINK_ROW + 0.5)) < 1.01 && r + 0.5 > UPLINK_ROW - 1 && r + 0.5 < UPLINK_ROW + 1) {
      const a = projectF(-0.5, r - 0.5);
      const b = projectF(-0.5, r + 0.5);
      fillPoly(ctx, [a, b, up(b, 12), up(a, 12)], "#1b2156");
      strokePoly(ctx, [up(a, 12), up(b, 12)], withAlpha(pal.cyan, 0.5), 1);
      continue;
    }
    const a = projectF(-0.5, r - 0.5);
    const b = projectF(-0.5, r + 0.5);
    fillPoly(ctx, [a, b, up(b, WALL_H), up(a, WALL_H)], "#1f2560");
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - WALL_H + 3);
    ctx.lineTo(b.x, b.y - 1);
    ctx.stroke();
  }
  // NE wall (row = -0.5), faces SW (darker)
  for (let c = 0; c < COLS; c++) {
    const a = projectF(c - 0.5, -0.5);
    const b = projectF(c + 0.5, -0.5);
    fillPoly(ctx, [a, b, up(b, WALL_H), up(a, WALL_H)], "#171c4c");
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - WALL_H + 3);
    ctx.lineTo(b.x, b.y - 1);
    ctx.stroke();
  }

  // neon rooflines: cyan → magenta gradients running along each wall top
  const roof = (a: Point, b: Point, c0: string, c1: string): void => {
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 6;
    ctx.shadowColor = pal.cyan;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - WALL_H);
    ctx.lineTo(b.x, b.y - WALL_H);
    ctx.stroke();
    ctx.restore();
  };
  roof(left, top, withAlpha(pal.cyan, 0.7), withAlpha(pal.violet, 0.7));
  roof(top, right, withAlpha(pal.violet, 0.7), withAlpha(pal.magenta, 0.7));

  // corner pillar at the top vertex
  fillPoly(
    ctx,
    [up(top, WALL_H + 4), { x: top.x + 3, y: top.y - WALL_H + 6 }, up(top, 2), { x: top.x - 3, y: top.y - WALL_H + 6 }],
    "#2a3170",
  );

  // INFERENCE signage on the NE wall — neon, gently breathing
  ctx.save();
  ctx.font = "700 8px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  const sign = { x: (top.x + right.x) / 2 + 28, y: (top.y + right.y) / 2 - WALL_H + 15 };
  ctx.shadowColor = pal.magenta;
  ctx.shadowBlur = 9;
  ctx.fillStyle = withAlpha(pal.magenta, 0.8 + 0.15 * Math.sin(now / 900));
  ctx.fillText("I N F E R E N C E", sign.x, sign.y);
  ctx.restore();

  drawUplink(ctx, pal, now);
}

/** The uplink citadel out on the apron: a tiered spire with glowing rings, beacon and beam. */
function drawUplink(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
  const base = UPLINK_POS;

  // twin fiber trunks: citadel → wall gap → just inside the hall
  const inside = projectF(0.1, UPLINK_ROW);
  for (const [col, off] of [
    [pal.cyan, -1.2],
    [pal.magenta, 1.2],
  ] as const) {
    ctx.save();
    ctx.strokeStyle = withAlpha(col, 0.4 + 0.18 * Math.sin(now / 450 + off));
    ctx.lineWidth = 1.4;
    ctx.shadowColor = col;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - 6 + off);
    ctx.lineTo(UPLINK_GAP.x, UPLINK_GAP.y + off);
    ctx.lineTo(inside.x, inside.y + off);
    ctx.stroke();
    ctx.restore();
  }

  // ground glow + pad ring
  const gg = ctx.createRadialGradient(base.x, base.y + 2, 0, base.x, base.y + 2, 26);
  gg.addColorStop(0, "rgba(94,232,255,0.16)");
  gg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gg;
  ctx.fillRect(base.x - 26, base.y - 11, 52, 26);

  // tiered spire
  const tiers: Array<[number, number, string]> = [
    [13, 17, "#222a68"],
    [9.5, 14, "#283277"],
    [6.5, 12, "#2f3b8a"],
  ];
  let yTop = base.y;
  for (const [tw, th, tone] of tiers) {
    ctx.fillStyle = tone;
    ctx.fillRect(base.x - tw, yTop - th, tw * 2, th);
    ctx.strokeStyle = "rgba(150,190,255,0.25)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(base.x - tw, yTop - th, tw * 2, th);
    yTop -= th;
    // glowing ring between tiers
    ctx.save();
    ctx.strokeStyle = withAlpha(pal.cyan, 0.55 + 0.25 * Math.sin(now / 600 + yTop));
    ctx.lineWidth = 1.3;
    ctx.shadowColor = pal.cyan;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(base.x, yTop, tw + 3.5, (tw + 3.5) * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // gold core window on the middle tier
  const corePulse = 0.55 + 0.4 * Math.abs(Math.sin(now / 700));
  ctx.fillStyle = withAlpha(pal.gold, corePulse);
  ctx.fillRect(base.x - 3.5, base.y - 26, 7, 6);

  // beacon beam + light
  const beam = ctx.createLinearGradient(0, yTop, 0, yTop - 44);
  beam.addColorStop(0, "rgba(94,232,255,0.35)");
  beam.addColorStop(1, "rgba(94,232,255,0)");
  ctx.fillStyle = beam;
  ctx.fillRect(base.x - 1.2, yTop - 44, 2.4, 44);
  const blink = (Math.sin(now / 500) + 1) / 2;
  ctx.fillStyle = withAlpha(pal.gold, 0.35 + 0.6 * blink);
  ctx.beginPath();
  ctx.arc(base.x, yTop - 3, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "600 5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.cyanHi, 0.8);
  ctx.fillText("UPLINK", base.x, base.y + 8);
  ctx.textAlign = "start";
}

/** Raised-floor tiles + per-rack heat glow + cooling aura + drifting light sweep. */
export function drawFloorTiles(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  state: GameState,
  online: number,
  now: number,
  reduced: boolean,
): void {
  // tiles: luminous indigo checker (with a teal-leaning alternate) + soft blue seams
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ce = tileCenter(c, r);
      const tone = (c + r) % 2 === 0 ? "#1d2458" : (c * 7 + r * 3) % 5 === 0 ? "#19294f" : "#1a2050";
      fillPoly(ctx, diamond(ce, 0.985), tone);
      strokePoly(ctx, diamond(ce, 0.985), "rgba(130,165,255,0.10)", 0.75);
    }
  }

  // cable trays: colored conduit runs from each power unit to its nearest powered rack — the
  // floor reads wired, not abstract. Power pulses travel these same L-paths.
  const powered = state.placed.filter((p) => p.kind === "power" && !(p.buildMs != null && p.buildMs > 0));
  const racksAll = state.placed.filter((p) => p.kind === "rack" && (p.gpus ?? 0) > 0);
  let trays = 0;
  for (const pw of powered) {
    if (trays >= 8 || racksAll.length === 0) break;
    let best = racksAll[0];
    let bd = Infinity;
    for (const rk of racksAll) {
      const d = Math.abs(rk.col - pw.col) + Math.abs(rk.row - pw.row);
      if (d < bd) {
        bd = d;
        best = rk;
      }
    }
    const a = tileCenter(pw.col, pw.row);
    const b = tileCenter(best.col, pw.row);
    const cc = tileCenter(best.col, best.row);
    for (const [off, col, wd] of [
      [0, "rgba(8,10,26,0.85)", 3.2],
      [-0.8, "rgba(251,146,60,0.5)", 1],
      [0.8, "rgba(34,211,238,0.45)", 1],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + off);
      ctx.lineTo(b.x, b.y + off);
      ctx.lineTo(cc.x, cc.y + off);
      ctx.stroke();
    }
    trays++;
  }

  // drifting light sweep across the floor (clipped to the hall)
  if (!reduced) {
    const { top, right, bottom, left } = hallCorners();
    const u = (now / 8000) % 1;
    const x0 = left.x + (right.x - left.x) * u;
    const span = (right.x - left.x) * 0.16;
    const g = ctx.createLinearGradient(x0 - span, 0, x0 + span, 0);
    g.addColorStop(0, "rgba(140,190,255,0)");
    g.addColorStop(0.5, "rgba(140,190,255,0.05)");
    g.addColorStop(1, "rgba(140,190,255,0)");
    ctx.save();
    pathPoly(ctx, [top, right, bottom, left]);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(left.x, top.y, right.x - left.x, bottom.y - top.y);
    ctx.restore();
  }

  // perforated tiles next to cooling units (orthogonal neighbours)
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (const p of state.placed) {
    if (p.kind !== "cooling") continue;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const c = p.col + dc;
      const r = p.row + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      if (state.placed.some((q) => q.col === c && q.row === r)) continue;
      const ce = tileCenter(c, r);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.ellipse(ce.x + i * 9 - j * 9, ce.y + (i * 9 + j * 9) * 0.5, 1.1, 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // cooling aura (teal), then heat glow (under loaded racks) on top
  const mult = techPowerMult(state.unlocked);
  for (const p of state.placed) {
    if (p.kind === "cooling") {
      const ce = tileCenter(p.col, p.row);
      glow(ctx, ce, HW * ((p.tier ?? 0) >= 1 ? 3.4 : 2.6), withAlpha(pal.teal, 0.09));
    }
  }
  for (const p of state.placed) {
    if (p.kind !== "rack") continue;
    const load = rackLoad(p, mult, online);
    if (load <= 0.02) continue;
    const ce = tileCenter(p.col, p.row);
    glow(ctx, ce, HW * (1.7 + load * 1.6), withAlpha(heatColor(load), 0.1 + load * 0.22));
  }
}

function glow(ctx: CanvasRenderingContext2D, c: Point, radius: number, color: string): void {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Cutaway front walls (SE + SW), drawn AFTER entities so the hall reads enclosed. */
export function drawFrontWalls(ctx: CanvasRenderingContext2D, pal: Palette): void {
  const { right, bottom, left } = hallCorners();
  const up = (p: Point, h: number): Point => ({ x: p.x, y: p.y - h });
  const h = LOW_WALL_H;
  fillPoly(ctx, [right, bottom, up(bottom, h), up(right, h)], "rgba(34,42,98,0.92)");
  strokePoly(ctx, [up(right, h), up(bottom, h)], withAlpha(pal.cyan, 0.35), 1.2);
  fillPoly(ctx, [bottom, left, up(left, h), up(bottom, h)], "rgba(26,32,80,0.92)");
  strokePoly(ctx, [up(bottom, h), up(left, h)], withAlpha(pal.cyan, 0.25), 1.2);
}
