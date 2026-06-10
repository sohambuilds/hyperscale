// Power infrastructure. Tier 0: a low rack PDU cabinet with a hazard chevron band. Tier 1: a
// taller substation with transformer fins, insulator bumps, and a stronger amber presence.

import { POWER_TIERS } from "../../../../game/config";
import type { Placed } from "../../../../game/types";
import type { Point } from "../../../../iso";
import { withAlpha, type Palette } from "../palette";
import { faceQuad, isoBox } from "../projection";
import { drawBoxBase, drawShadow, entityDims, fillPoly, strokePoly } from "./common";

export interface UnitView {
  now: number;
  selected: boolean;
  hovered: boolean;
}

export function drawPower(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed, v: UnitView): void {
  const tier = p.tier ?? 0;
  const { s, h } = entityDims(p);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  drawBoxBase(ctx, pal, box, { selected: v.selected, hovered: v.hovered, t: "#221d33" });

  // hazard chevron band along the bottom of the front (right) face
  const bandTop = h - 6;
  const band = faceQuad(box.s, box.e, 0.04, bandTop, 0.96, h - 2);
  fillPoly(ctx, band, "#1a1305");
  ctx.save();
  ctx.beginPath();
  const clip = band;
  ctx.moveTo(clip[0].x, clip[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(clip[i].x, clip[i].y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = withAlpha(pal.amber, 0.75);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 10; i++) {
    const q0 = faceQuad(box.s, box.e, i * 0.12 - 0.1, bandTop, i * 0.12, h - 2);
    ctx.beginPath();
    ctx.moveTo(q0[0].x, q0[0].y);
    ctx.lineTo(q0[2].x, q0[2].y);
    ctx.stroke();
  }
  ctx.restore();

  if (tier >= 1) {
    // transformer fins on the left face
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const q = faceQuad(box.w, box.s, 0.12 + i * 0.17, 4, 0.12 + i * 0.17, h - 8);
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      ctx.lineTo(q[3].x, q[3].y);
      ctx.stroke();
    }
    // insulators on top
    for (let i = 0; i < 3; i++) {
      const t = 0.3 + i * 0.2;
      const x = box.n.x + (box.e.x - box.n.x) * t;
      const y = box.n.y + (box.e.y - box.n.y) * t;
      ctx.fillStyle = "#2a2438";
      ctx.fillRect(x - 1, y - 4, 2, 4);
      ctx.fillStyle = withAlpha(pal.amber, 0.8);
      ctx.beginPath();
      ctx.arc(x, y - 5, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // pulsing core lamp on the top face
  const pulse = 0.45 + 0.45 * Math.abs(Math.sin(v.now / 700));
  const core = { x: (box.n.x + box.s.x) / 2, y: (box.n.y + box.s.y) / 2 };
  ctx.fillStyle = withAlpha(pal.amber, pulse);
  ctx.beginPath();
  ctx.arc(core.x, core.y, tier >= 1 ? 2.6 : 2, 0, Math.PI * 2);
  ctx.fill();
  // bolt glyph
  ctx.strokeStyle = withAlpha("#1a1305", 0.9);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(core.x + 0.8, core.y - 1.4);
  ctx.lineTo(core.x - 0.6, core.y + 0.2);
  ctx.lineTo(core.x + 0.6, core.y + 0.2);
  ctx.lineTo(core.x - 0.8, core.y + 1.6);
  ctx.stroke();

  // kW tag on the front face
  ctx.font = "700 5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.amber, 0.85);
  const tag = faceQuad(box.s, box.e, 0.5, Math.max(4, bandTop - 8), 0.5, bandTop - 2);
  ctx.fillText(`${POWER_TIERS[tier].kw}kW`, tag[0].x, tag[0].y + 4);
  ctx.textAlign = "start";
  strokePoly(ctx, box.top, withAlpha(pal.amber, v.selected ? 0.0 : 0.18), 0.8);
}
