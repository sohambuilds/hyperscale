// Shared sprite plumbing: fill/stroke helpers, footprint dims per entity, the base extruded box
// (faces + rim + selection), drop shadows, and the body hit-test used for click routing.

import type { Point } from "../../../../iso";
import type { Placed } from "../../../../game/types";
import { withAlpha, type Palette } from "../palette";
import { diamond, isoBox, pathPoly, pointInPoly, tileCenter, type IsoBox } from "../projection";

export function fillPoly(ctx: CanvasRenderingContext2D, pts: Point[], fill: string): void {
  pathPoly(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokePoly(ctx: CanvasRenderingContext2D, pts: Point[], stroke: string, w = 1): void {
  pathPoly(ctx, pts);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Footprint scale + body height per entity (also drives hit-testing). */
export function entityDims(p: Placed): { s: number; h: number } {
  if (p.kind === "rack") return { s: 0.78, h: 34 };
  if (p.kind === "power") return (p.tier ?? 0) >= 1 ? { s: 0.82, h: 30 } : { s: 0.62, h: 20 };
  if (p.kind === "network") return (p.tier ?? 0) >= 1 ? { s: 0.74, h: 26 } : { s: 0.66, h: 22 };
  if (p.kind === "crewpod") return { s: 0.74, h: 20 };
  return (p.tier ?? 0) >= 1 ? { s: 0.8, h: 32 } : { s: 0.72, h: 26 }; // cooling CRAC/chiller
}

/** Deterministic 0..999 phase from an entity id — desyncs per-building idle animation. */
export function idPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 0) % 1000;
}

/** Soft identity-colored pool of light under a building — makes it read as a valuable asset. */
export function groundGlow(ctx: CanvasRenderingContext2D, c: Point, color: string, r: number, a: number): void {
  ctx.save();
  ctx.translate(c.x, c.y + 1);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, withAlpha(color, a));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Topmost entity whose visible body (top/left/right faces) contains the world point. */
export function entityAt(x: number, y: number, placed: Placed[]): Placed | null {
  const sorted = [...placed].sort((a, b) => b.col + b.row - (a.col + a.row) || b.col - a.col);
  for (const p of sorted) {
    const { s, h } = entityDims(p);
    const box = isoBox(tileCenter(p.col, p.row), s, h);
    if (pointInPoly(x, y, box.top) || pointInPoly(x, y, box.left) || pointInPoly(x, y, box.right)) {
      return p;
    }
  }
  return null;
}

export function drawShadow(ctx: CanvasRenderingContext2D, c: Point, s: number): void {
  ctx.save();
  ctx.translate(c.x + 2, c.y + 2);
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, 14 * s + 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();
  ctx.restore();
}

export interface BoxStyle {
  l?: string;
  r?: string;
  t?: string;
  selected?: boolean;
  hovered?: boolean;
}

/** The standard graphite cabinet: three faces + rim, selection lifts the top tone + cyan rim. */
export function drawBoxBase(ctx: CanvasRenderingContext2D, pal: Palette, box: IsoBox, st: BoxStyle): void {
  fillPoly(ctx, box.left, st.l ?? pal.faceL);
  fillPoly(ctx, box.right, st.r ?? pal.faceR);
  fillPoly(ctx, box.top, st.selected ? pal.faceTSel : (st.t ?? pal.faceT));
  strokePoly(ctx, box.top, st.selected ? pal.cyan : st.hovered ? withAlpha(pal.cyan, 0.6) : pal.rim, st.selected ? 1.6 : 1);
}

/** Cyan selection diamond on the floor under a selected entity. */
export function drawSelectionRing(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, now: number): void {
  const pulse = 0.55 + 0.25 * Math.sin(now / 320);
  ctx.setLineDash([4, 3]);
  strokePoly(ctx, diamond(c, 1.02), withAlpha(pal.cyan, pulse), 1.4);
  ctx.setLineDash([]);
}
