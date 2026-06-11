// Power — real switchgear, neon-lit. Tier 0: a PDU/genset cabinet with glowing heat vents, a
// hazard chevron stripe and a beacon. Tier 1: a substation transformer with ceramic bushings on
// top, a drooping HV cable and twin vent banks. Identity color: orange/gold.

import { POWER_TIERS } from "../../../../game/config";
import type { Placed } from "../../../../game/types";
import type { Point } from "../../../../iso";
import { withAlpha, type Palette } from "../palette";
import { HW, faceQuad, isoBox } from "../projection";
import { drawBoxBase, drawShadow, entityDims, fillPoly, groundGlow, idPhase } from "./common";

export interface UnitView {
  now: number;
  selected: boolean;
  hovered: boolean;
}

export function drawPower(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed, v: UnitView): void {
  const tier = p.tier ?? 0;
  const { s, h } = entityDims(p);
  const ph = idPhase(p.id) / 100;
  const hum = 0.5 + 0.5 * Math.abs(Math.sin(v.now / 640 + ph));

  groundGlow(ctx, c, pal.orange, HW * (tier >= 1 ? 2.5 : 1.9), 0.10 + 0.04 * hum);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  drawBoxBase(ctx, pal, box, { selected: v.selected, hovered: v.hovered, l: "#2e2138", r: "#3a2a42", t: "#4a3550" });

  // glowing heat-vent bank(s) on the front face — the "this thing is LIVE" read
  const vents = tier >= 1 ? 2 : 1;
  for (let b = 0; b < vents; b++) {
    const x0 = 0.12 + b * 0.46;
    for (let i = 0; i < 3; i++) {
      const d = 5 + i * 3.2;
      const q = faceQuad(box.s, box.e, x0, d, x0 + 0.3, d + 1.7);
      const flick = 0.45 + 0.3 * Math.sin(v.now / 230 + i * 1.7 + b * 2.4 + ph);
      fillPoly(ctx, q, withAlpha(pal.orange, flick));
    }
  }

  // hazard chevron stripe along the bottom of the front face
  const bandTop = h - 5.5;
  const band = faceQuad(box.s, box.e, 0.04, bandTop, 0.96, h - 1.5);
  fillPoly(ctx, band, "#241606");
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(band[0].x, band[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(band[i].x, band[i].y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = withAlpha(pal.gold, 0.85);
  ctx.lineWidth = 1.7;
  for (let i = 0; i < 10; i++) {
    const q0 = faceQuad(box.s, box.e, i * 0.12 - 0.1, bandTop, i * 0.12, h - 1.5);
    ctx.beginPath();
    ctx.moveTo(q0[0].x, q0[0].y);
    ctx.lineTo(q0[2].x, q0[2].y);
    ctx.stroke();
  }
  ctx.restore();

  // ceramic bushings on top (transformer insulators) — 2 on tier 0, 3 on tier 1
  const nB = tier >= 1 ? 3 : 2;
  for (let i = 0; i < nB; i++) {
    const t = 0.5 - ((nB - 1) / 2) * 0.26 + i * 0.26;
    const bx = box.n.x + (box.e.x - box.n.x) * t;
    const by = box.n.y + (box.e.y - box.n.y) * t;
    // stacked ceramic discs
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k % 2 === 0 ? "#5b4a6e" : "#46375a";
      ctx.beginPath();
      ctx.ellipse(bx, by - 2 - k * 2.4, 2.3 - k * 0.3, 1.1 - k * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // energized cap
    ctx.fillStyle = withAlpha(pal.gold, 0.55 + 0.4 * Math.abs(Math.sin(v.now / 420 + i * 1.3 + ph)));
    ctx.beginPath();
    ctx.arc(bx, by - 9.4, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // HV cable drooping from the first bushing off the back (tier 1)
  if (tier >= 1) {
    const t0 = 0.5 - 0.26;
    const bx = box.n.x + (box.e.x - box.n.x) * t0;
    const by = box.n.y + (box.e.y - box.n.y) * t0 - 9;
    ctx.strokeStyle = "rgba(20, 16, 30, 0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - 10, by + 4, bx - 13, c.y - 2);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(pal.gold, 0.25);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - 10, by + 4, bx - 13, c.y - 2);
    ctx.stroke();
  }

  // electric arc flicker between bushings — rare, quick
  if (Math.sin(v.now / 90 + ph * 7) > 0.985 && nB >= 2) {
    const t1 = 0.5 - ((nB - 1) / 2) * 0.26;
    const t2 = t1 + 0.26;
    const x1 = box.n.x + (box.e.x - box.n.x) * t1;
    const y1 = box.n.y + (box.e.y - box.n.y) * t1 - 9.4;
    const x2 = box.n.x + (box.e.x - box.n.x) * t2;
    const y2 = box.n.y + (box.e.y - box.n.y) * t2 - 9.4;
    ctx.strokeStyle = withAlpha("#fff3c4", 0.9);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo((x1 + x2) / 2 + 1.5, (y1 + y2) / 2 - 2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // status beacon + kW tag
  ctx.fillStyle = withAlpha(pal.gold, 0.45 + 0.5 * ((Math.sin(v.now / 500 + ph) + 1) / 2));
  ctx.fillRect(box.e.x - 3.4, box.e.y + 3, 1.6, 1.6);
  ctx.font = "700 5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.gold, 0.95);
  const tag = faceQuad(box.s, box.e, 0.5, Math.max(4, bandTop - 8), 0.5, bandTop - 2);
  ctx.fillText(`${POWER_TIERS[tier].kw}kW`, tag[0].x, tag[0].y + 4);
  ctx.textAlign = "start";
}
