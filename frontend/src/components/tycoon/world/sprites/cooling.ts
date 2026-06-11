// Cooling — real datacenter gear, neon-lit: tier 0 is a CRAC unit with a big top fan spinning in
// a glowing shroud; tier 1 is a liquid-cooling chiller with twin fans and coolant pipes running
// into the floor. Vapor wisps rise off the fans. Identity color: teal/ice.

import { COOLING_TIERS } from "../../../../game/config";
import type { Placed } from "../../../../game/types";
import type { Point } from "../../../../iso";
import { withAlpha, type Palette } from "../palette";
import { HW, faceQuad, isoBox } from "../projection";
import { drawBoxBase, drawShadow, entityDims, fillPoly, groundGlow, idPhase } from "./common";
import type { UnitView } from "./power";

function fan(ctx: CanvasRenderingContext2D, pal: Palette, cx: number, cy: number, r: number, now: number, ph: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.5);
  // shroud well
  ctx.beginPath();
  ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = "#0d1830";
  ctx.fill();
  ctx.strokeStyle = withAlpha(pal.teal, 0.65 + 0.2 * Math.sin(now / 600 + ph));
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // spinning blades
  const a = (now / 320 + ph) % (Math.PI * 2);
  ctx.strokeStyle = withAlpha("#9deffa", 0.9);
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const ang = a + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6);
    ctx.lineTo(Math.cos(ang) * (r - 1.4), Math.sin(ang) * (r - 1.4));
    ctx.stroke();
  }
  // hub
  ctx.fillStyle = "#d6f6ff";
  ctx.beginPath();
  ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // protective grille
  ctx.strokeStyle = "rgba(214, 246, 255, 0.18)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawCooling(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed, v: UnitView): void {
  const tier = p.tier ?? 0;
  const { s, h } = entityDims(p);
  const ph = idPhase(p.id) / 100;

  groundGlow(ctx, c, pal.teal, HW * (tier >= 1 ? 2.6 : 2.1), 0.11);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  drawBoxBase(ctx, pal, box, { selected: v.selected, hovered: v.hovered, l: "#152a52", r: "#1b3766", t: "#264a80" });

  // front louvers with a cool glow bleeding through
  for (let i = 0; i < 4; i++) {
    const d = 5 + i * ((h - 10) / 4);
    const q = faceQuad(box.s, box.e, 0.1, d, 0.9, d + 1.6);
    fillPoly(ctx, q, withAlpha(pal.teal, 0.16 + 0.06 * Math.sin(v.now / 900 + ph + i)));
  }

  // top fan(s) — the signature
  const topC = { x: (box.n.x + box.s.x) / 2, y: (box.n.y + box.s.y) / 2 };
  if (tier === 0) {
    fan(ctx, pal, topC.x, topC.y, 7.5, v.now, ph);
  } else {
    fan(ctx, pal, topC.x - HW * s * 0.3, topC.y + HW * s * 0.15, 5.6, v.now, ph);
    fan(ctx, pal, topC.x + HW * s * 0.3, topC.y - HW * s * 0.15, 5.6, v.now, ph + 2.1);
    // coolant loop: supply + return pipes off the left face into the floor
    ctx.lineCap = "round";
    for (const [off, col] of [
      [-2.2, pal.teal],
      [2.2, pal.cyan],
    ] as const) {
      ctx.strokeStyle = withAlpha(col, 0.85);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(box.w.x + 2, box.w.y + 4 + off * 0.4);
      ctx.lineTo(box.w.x - 5 + off, box.w.y + 9 + off * 0.4);
      ctx.lineTo(box.w.x - 5 + off, c.y + 2);
      ctx.stroke();
    }
    // pump lamp
    const pump = 0.4 + 0.5 * Math.abs(Math.sin(v.now / 520 + ph));
    ctx.fillStyle = withAlpha(pal.cyan, pump);
    ctx.beginPath();
    ctx.arc(box.w.x - 5, c.y + 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // vapor wisps rising off the fans
  for (let i = 0; i < 3; i++) {
    const u = (((v.now / 1600 + i * 0.37 + ph) % 1) + 1) % 1;
    const vx = topC.x + Math.sin((u + i) * 7.1 + ph) * 5;
    const vy = topC.y - h * 0.2 - u * 16;
    ctx.fillStyle = withAlpha("#cdf6ff", 0.16 * (1 - u));
    ctx.beginPath();
    ctx.arc(vx, vy, 1.6 + u * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // status LED + kW tag
  ctx.fillStyle = withAlpha(pal.teal, 0.5 + 0.5 * ((Math.sin(v.now / 700 + ph) + 1) / 2));
  ctx.fillRect(box.e.x - 3.4, box.e.y + 3, 1.6, 1.6);
  ctx.font = "700 5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.teal, 0.95);
  const tag = faceQuad(box.s, box.e, 0.5, h - 7, 0.5, h - 2);
  ctx.fillText(`${COOLING_TIERS[tier].kw}kW`, tag[0].x, tag[0].y + 4);
  ctx.textAlign = "start";
}
