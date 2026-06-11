// Network — a core-switch cabinet, neon-lit: patch-panel rows of multicolor blinking port LEDs,
// a glowing fiber trunk rising toward the uplink wall, and an antenna mast (tier 1 adds a dish
// and a second LED bank). Identity color: magenta/violet.

import { NETWORK_TIERS } from "../../../../game/config";
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

/** A patch-panel row: small square ports blinking in mixed colors — link, activity, errors. */
function portRow(ctx: CanvasRenderingContext2D, pal: Palette, box: ReturnType<typeof isoBox>, d: number, n: number, now: number, seed: number): void {
  const colors = [pal.cyan, pal.green, pal.magenta, pal.gold];
  for (let i = 0; i < n; i++) {
    const t0 = 0.08 + (i / n) * 0.84;
    const q = faceQuad(box.s, box.e, t0, d, t0 + 0.055, d + 2.2);
    const on = Math.sin(now / 170 + i * 2.3 + seed * 5) > -0.25;
    const col = colors[(i + seed) % colors.length];
    fillPoly(ctx, q, withAlpha(col, on ? 0.95 : 0.18));
  }
}

export function drawNetwork(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed, v: UnitView): void {
  const tier = p.tier ?? 0;
  const { s, h } = entityDims(p);
  const ph = idPhase(p.id) / 100;

  groundGlow(ctx, c, pal.magenta, HW * (tier >= 1 ? 2.3 : 1.8), 0.10);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  drawBoxBase(ctx, pal, box, { selected: v.selected, hovered: v.hovered, l: "#241f50", r: "#2d2762", t: "#3b3380" });

  // patch-panel LED rows on the front face
  portRow(ctx, pal, box, h - 6, tier >= 1 ? 10 : 7, v.now, 0);
  portRow(ctx, pal, box, h - 10.5, tier >= 1 ? 10 : 7, v.now, 1);
  if (tier >= 1) portRow(ctx, pal, box, h - 15, 10, v.now, 2);

  // cable management bar under the ports
  const bar = faceQuad(box.s, box.e, 0.08, h - 3.4, 0.92, h - 2.2);
  fillPoly(ctx, bar, "rgba(255,255,255,0.07)");

  // fiber trunk: glowing line rising off the top-back toward the uplink wall, pulse bead running
  const trunkBase = { x: (box.n.x + box.w.x) / 2, y: (box.n.y + box.w.y) / 2 };
  const trunkTop = { x: trunkBase.x - 4, y: trunkBase.y - (tier >= 1 ? 15 : 11) };
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.magenta, 0.6);
  ctx.shadowColor = pal.magenta;
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(trunkBase.x, trunkBase.y);
  ctx.lineTo(trunkTop.x, trunkTop.y);
  ctx.stroke();
  ctx.restore();
  const beadU = ((v.now / 800 + ph) % 1 + 1) % 1;
  ctx.fillStyle = withAlpha("#ffd7f0", 0.95);
  ctx.beginPath();
  ctx.arc(trunkBase.x + (trunkTop.x - trunkBase.x) * beadU, trunkBase.y + (trunkTop.y - trunkBase.y) * beadU, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // antenna mast on the top-right corner with a blinking tip
  const mastX = (box.n.x + box.e.x) / 2;
  const mastY = (box.n.y + box.e.y) / 2;
  const mastH = tier >= 1 ? 13 : 9;
  ctx.strokeStyle = "rgba(220, 210, 255, 0.55)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(mastX, mastY);
  ctx.lineTo(mastX, mastY - mastH);
  ctx.stroke();
  const blink = Math.sin(v.now / 380 + ph) > 0.3;
  ctx.fillStyle = withAlpha(pal.magenta, blink ? 0.95 : 0.25);
  ctx.beginPath();
  ctx.arc(mastX, mastY - mastH - 1.2, 1.3, 0, Math.PI * 2);
  ctx.fill();
  if (tier >= 1) {
    // small uplink dish on the mast
    ctx.fillStyle = "#3d3470";
    ctx.beginPath();
    ctx.ellipse(mastX - 2.6, mastY - mastH + 3.5, 2.6, 1.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(pal.violet, 0.7);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // req/s capacity tag
  ctx.font = "700 5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.magenta, 0.95);
  const tag = faceQuad(box.w, box.s, 0.5, h - 8, 0.5, h - 3);
  ctx.fillText(`${NETWORK_TIERS[tier].cap}/s`, tag[0].x, tag[0].y + 4);
  ctx.textAlign = "start";
}
