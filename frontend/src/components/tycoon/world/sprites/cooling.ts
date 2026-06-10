// Cooling infrastructure. Tier 0: a CRAC unit with louvers and a spinning top fan. Tier 1: a
// direct-to-chip liquid CDU — manifold pipes instead of a fan, with a coolant pump pulse.

import { COOLING_TIERS } from "../../../../game/config";
import type { Placed } from "../../../../game/types";
import type { Point } from "../../../../iso";
import { withAlpha, type Palette } from "../palette";
import { faceQuad, isoBox } from "../projection";
import { drawBoxBase, drawShadow, entityDims, strokePoly } from "./common";
import type { UnitView } from "./power";

export function drawCooling(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed, v: UnitView): void {
  const tier = p.tier ?? 0;
  const { s, h } = entityDims(p);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  drawBoxBase(ctx, pal, box, { selected: v.selected, hovered: v.hovered, t: "#15203a" });

  // louvers on the front (right) face
  ctx.strokeStyle = withAlpha(pal.blue, 0.35);
  ctx.lineWidth = 0.8;
  const louvers = tier >= 1 ? 3 : 5;
  for (let i = 0; i < louvers; i++) {
    const d = 6 + i * ((h - 12) / louvers);
    const q = faceQuad(box.s, box.e, 0.12, d, 0.88, d);
    ctx.beginPath();
    ctx.moveTo(q[0].x, q[0].y);
    ctx.lineTo(q[1].x, q[1].y);
    ctx.stroke();
  }

  const topC = { x: (box.n.x + box.s.x) / 2, y: (box.n.y + box.s.y) / 2 };

  if (tier === 0) {
    // spinning fan on the top face (iso ellipse)
    ctx.save();
    ctx.translate(topC.x, topC.y);
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0b1422";
    ctx.fill();
    ctx.strokeStyle = withAlpha(pal.blue, 0.5);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    const a = (v.now / 380) % (Math.PI * 2);
    ctx.strokeStyle = withAlpha(pal.blue, 0.85);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const ang = a + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 1.5, Math.sin(ang) * 1.5);
      ctx.lineTo(Math.cos(ang) * 6.2, Math.sin(ang) * 6.2);
      ctx.stroke();
    }
    ctx.fillStyle = "#cfe4ff";
    ctx.beginPath();
    ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // CDU: two coolant pipes across the top + pump lamp
    ctx.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      const off = i === 0 ? -2.5 : 2.5;
      ctx.strokeStyle = withAlpha(i === 0 ? pal.blue : pal.cyan, 0.8);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(box.w.x + 3, box.w.y + off * 0.5 + 1);
      ctx.lineTo(topC.x + off, topC.y + off * 0.5);
      ctx.lineTo(box.e.x - 3, box.e.y + off * 0.5 + 1);
      ctx.stroke();
    }
    const pump = 0.4 + 0.5 * Math.abs(Math.sin(v.now / 520));
    ctx.fillStyle = withAlpha(pal.cyan, pump);
    ctx.beginPath();
    ctx.arc(topC.x, topC.y + 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // kW tag
  ctx.font = "700 5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.blue, 0.85);
  const tag = faceQuad(box.s, box.e, 0.5, h - 7, 0.5, h - 2);
  ctx.fillText(`${COOLING_TIERS[tier].kw}kW`, tag[0].x, tag[0].y + 4);
  ctx.textAlign = "start";
  strokePoly(ctx, box.top, withAlpha(pal.blue, v.selected ? 0 : 0.15), 0.8);
}
