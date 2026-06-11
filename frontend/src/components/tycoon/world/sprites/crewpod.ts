// Crew pod — the warm, human building: a cozy site-cabin with a string of golden lights, a lit
// window, a waving pennant flag and a beacon. Identity color: gold/warm amber.

import type { Placed } from "../../../../game/types";
import type { Point } from "../../../../iso";
import { withAlpha, type Palette } from "../palette";
import { HW, faceQuad, isoBox } from "../projection";
import { drawBoxBase, drawShadow, entityDims, fillPoly, groundGlow, idPhase, strokePoly } from "./common";

export interface UnitView {
  now: number;
  selected: boolean;
  hovered: boolean;
}

export function drawCrewPod(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed, v: UnitView): void {
  const { s, h } = entityDims(p);
  const ph = idPhase(p.id);

  groundGlow(ctx, c, pal.gold, HW * 1.9, 0.10);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  drawBoxBase(ctx, pal, box, { selected: v.selected, hovered: v.hovered, l: "#33284e", r: "#403158", t: "#4d3a66" });

  // gold livery stripe along the top of the front face
  const stripe = faceQuad(box.s, box.e, 0.04, 2, 0.96, 5);
  fillPoly(ctx, stripe, withAlpha(pal.gold, 0.5));

  // string of party lights along the front roof edge
  for (let i = 0; i < 5; i++) {
    const t = 0.12 + i * 0.19;
    const lx = box.s.x + (box.e.x - box.s.x) * t;
    const ly = box.s.y + (box.e.y - box.s.y) * t + 1.5 + Math.sin(i * 2.2) * 0.8;
    const on = Math.sin(v.now / 420 + i * 1.4 + ph) > -0.3;
    const col = i % 3 === 0 ? pal.magenta : i % 3 === 1 ? pal.gold : pal.teal;
    ctx.fillStyle = withAlpha(col, on ? 0.95 : 0.25);
    ctx.beginPath();
    ctx.arc(lx, ly, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // lit window (front-left) — warm glow, someone's home
  const flick = 0.5 + 0.3 * Math.abs(Math.sin(v.now / 900 + 1.3 + ph));
  const win = faceQuad(box.s, box.e, 0.14, h - 11, 0.42, h - 5);
  fillPoly(ctx, win, withAlpha(pal.gold, 0.25 + 0.3 * flick));
  strokePoly(ctx, win, withAlpha(pal.gold, 0.6), 0.7);

  // door (front-right)
  const door = faceQuad(box.s, box.e, 0.62, h - 12, 0.84, h - 1.5);
  fillPoly(ctx, door, "#241a38");
  strokePoly(ctx, door, withAlpha(pal.fgMuted, 0.6), 0.7);
  ctx.fillStyle = withAlpha(pal.gold, 0.85);
  ctx.beginPath();
  ctx.arc(door[1].x - 1.2, (door[1].y + door[2].y) / 2, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // pennant flag on the roof — waves in the wind
  const poleX = (box.n.x + box.w.x) / 2;
  const poleY = (box.n.y + box.w.y) / 2;
  ctx.strokeStyle = withAlpha(pal.fgMuted, 0.8);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(poleX, poleY);
  ctx.lineTo(poleX, poleY - 10);
  ctx.stroke();
  const wave = Math.sin(v.now / 260 + ph) * 1.6;
  ctx.fillStyle = withAlpha(pal.gold, 0.95);
  ctx.beginPath();
  ctx.moveTo(poleX, poleY - 10);
  ctx.lineTo(poleX + 6, poleY - 8.6 + wave * 0.4);
  ctx.lineTo(poleX, poleY - 7.2);
  ctx.closePath();
  ctx.fill();

  // roof beacon — slow gold pulse marking an occupied pod
  const pulse = 0.45 + 0.4 * Math.abs(Math.sin(v.now / 600 + ph));
  const roof = { x: (box.n.x + box.e.x) / 2, y: (box.n.y + box.e.y) / 2 };
  ctx.fillStyle = withAlpha(pal.gold, pulse);
  ctx.beginPath();
  ctx.arc(roof.x, roof.y - 1.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
}
