// The place itself: exterior backdrop + concrete apron, the building shell (full-height back
// walls, cutaway front walls — the RCT trick), the raised-floor tile grid, heat/cool floor
// glows, and the fiber-uplink pylon feeding the hall.

import type { Point } from "../../../../iso";
import { heatColor } from "../../../../iso";
import type { GameState } from "../../../../game/types";
import { rackLoad, techPowerMult } from "../../selectors";
import { withAlpha, type Palette } from "../palette";
import {
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
  projectF,
  tileCenter,
} from "../projection";
import { fillPoly, strokePoly } from "./common";

/** Screen-space backdrop behind the world (drawn before the camera transform). */
export function drawBackdrop(ctx: CanvasRenderingContext2D, pal: Palette, vw: number, vh: number): void {
  const g = ctx.createRadialGradient(vw * 0.7, -vh * 0.1, 0, vw * 0.7, -vh * 0.1, vh * 1.3);
  g.addColorStop(0, withAlpha(pal.cyan, 0.045));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = pal.voidC;
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
}

function apronCorners(pad: number): Point[] {
  return [
    projectF(-0.5 - pad, -0.5 - pad),
    projectF(COLS - 0.5 + pad, -0.5 - pad),
    projectF(COLS - 0.5 + pad, ROWS - 0.5 + pad),
    projectF(-0.5 - pad, ROWS - 0.5 + pad),
  ];
}

/** Concrete lot around the building, with faint expansion joints and a service road stub. */
export function drawApron(ctx: CanvasRenderingContext2D): void {
  fillPoly(ctx, apronCorners(2.1), "#0a0d15");
  strokePoly(ctx, apronCorners(2.1), "rgba(255,255,255,0.04)", 1);
  // expansion joints parallel to the hall edges
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let k = 1; k <= 2; k++) {
    const pts = apronCorners(k * 0.7);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  // service road stub out from the uplink side
  const a = projectF(-0.6, UPLINK_ROW - 0.55);
  const b = projectF(-2.6, UPLINK_ROW - 0.55);
  const c = projectF(-2.6, UPLINK_ROW + 0.55);
  const d = projectF(-0.6, UPLINK_ROW + 0.55);
  fillPoly(ctx, [a, b, c, d], "#0c1019");
}

/** Full-height back walls (NW + NE) with panel seams, roofline, and the uplink cable gap. */
export function drawBackWalls(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
  const { top, right } = hallCorners();
  const up = (p: Point, h: number): Point => ({ x: p.x, y: p.y - h });

  // NW wall (col = -0.5), faces SE (lighter) — drawn per-tile so the uplink gap can be skipped
  for (let r = 0; r < ROWS; r++) {
    if (Math.abs(r + 0.5 - (UPLINK_ROW + 0.5)) < 1.01 && r + 0.5 > UPLINK_ROW - 1 && r + 0.5 < UPLINK_ROW + 1) {
      // the two tiles around the gap get a half-height wall with a conduit opening
      const a = projectF(-0.5, r - 0.5);
      const b = projectF(-0.5, r + 0.5);
      fillPoly(ctx, [a, b, up(b, 12), up(a, 12)], "#0e1424");
      strokePoly(ctx, [up(a, 12), up(b, 12)], pal.rim, 1);
      continue;
    }
    const a = projectF(-0.5, r - 0.5);
    const b = projectF(-0.5, r + 0.5);
    fillPoly(ctx, [a, b, up(b, WALL_H), up(a, WALL_H)], "#101727");
    strokePoly(ctx, [up(a, WALL_H), up(b, WALL_H)], "rgba(255,255,255,0.10)", 1.4);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
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
    fillPoly(ctx, [a, b, up(b, WALL_H), up(a, WALL_H)], "#0b101d");
    strokePoly(ctx, [up(a, WALL_H), up(b, WALL_H)], "rgba(255,255,255,0.08)", 1.4);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - WALL_H + 3);
    ctx.lineTo(b.x, b.y - 1);
    ctx.stroke();
  }
  // corner pillar at the top vertex
  fillPoly(
    ctx,
    [up(top, WALL_H + 4), { x: top.x + 3, y: top.y - WALL_H + 6 }, up(top, 2), { x: top.x - 3, y: top.y - WALL_H + 6 }],
    "#141b2e",
  );
  // INFERENCE signage on the NE wall, near the right corner
  ctx.save();
  ctx.font = "700 7px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  const sign = { x: (top.x + right.x) / 2 + 28, y: (top.y + right.y) / 2 - WALL_H + 14 };
  ctx.fillStyle = withAlpha(pal.cyan, 0.75 + 0.15 * Math.sin(now / 900));
  ctx.fillText("I N F E R E N C E", sign.x, sign.y);
  ctx.restore();

  drawUplink(ctx, pal, now);
}

/** The fiber uplink pylon out on the apron + glowing trunk line into the hall. */
function drawUplink(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
  // trunk line: pylon → wall gap → just inside the hall
  const inside = projectF(0.1, UPLINK_ROW);
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.cyan, 0.4 + 0.18 * Math.sin(now / 450));
  ctx.lineWidth = 1.6;
  ctx.shadowColor = pal.cyan;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(UPLINK_POS.x, UPLINK_POS.y - 4);
  ctx.lineTo(UPLINK_GAP.x, UPLINK_GAP.y);
  ctx.lineTo(inside.x, inside.y);
  ctx.stroke();
  ctx.restore();

  // pylon: small cabinet + mast + blinking beacon
  const base = UPLINK_POS;
  const h = 18;
  fillPoly(
    ctx,
    [
      { x: base.x - 7, y: base.y },
      { x: base.x + 7, y: base.y },
      { x: base.x + 7, y: base.y - h },
      { x: base.x - 7, y: base.y - h },
    ],
    "#121a2c",
  );
  ctx.strokeStyle = pal.rim;
  ctx.lineWidth = 1;
  ctx.strokeRect(base.x - 7, base.y - h, 14, h);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y - h);
  ctx.lineTo(base.x, base.y - h - 14);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.stroke();
  const blink = (Math.sin(now / 500) + 1) / 2;
  ctx.fillStyle = withAlpha(pal.cyan, 0.35 + 0.6 * blink);
  ctx.beginPath();
  ctx.arc(base.x, base.y - h - 15, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "600 5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.fgDim, 0.9);
  ctx.fillText("UPLINK", base.x, base.y + 8);
  ctx.textAlign = "start";
}

/** Raised-floor tiles + per-rack heat glow + cooling aura. Drawn under everything placed. */
export function drawFloorTiles(ctx: CanvasRenderingContext2D, pal: Palette, state: GameState, online: number): void {
  // tiles: subtle two-tone checker, hairline edges
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ce = tileCenter(c, r);
      fillPoly(ctx, diamond(ce, 0.985), (c + r) % 2 === 0 ? "#11151f" : "#0f131d");
      strokePoly(ctx, diamond(ce, 0.985), "rgba(255,255,255,0.045)", 0.75);
    }
  }
  // perforated tiles next to cooling units (orthogonal neighbours)
  ctx.fillStyle = "rgba(0,0,0,0.45)";
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
  // cooling aura (cool blue tint), then heat glow (under loaded racks) on top
  const mult = techPowerMult(state.unlocked);
  for (const p of state.placed) {
    if (p.kind === "cooling") {
      const ce = tileCenter(p.col, p.row);
      glow(ctx, ce, HW * ((p.tier ?? 0) >= 1 ? 3.4 : 2.6), withAlpha(pal.blue, 0.07));
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
  fillPoly(ctx, [right, bottom, up(bottom, h), up(right, h)], "rgba(13,18,33,0.92)");
  strokePoly(ctx, [up(right, h), up(bottom, h)], pal.rim, 1.2);
  fillPoly(ctx, [bottom, left, up(left, h), up(bottom, h)], "rgba(10,14,26,0.92)");
  strokePoly(ctx, [up(bottom, h), up(left, h)], "rgba(255,255,255,0.10)", 1.2);
}
