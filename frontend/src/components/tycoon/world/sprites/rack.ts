// The hero sprite: a server rack cabinet. The SE face is the front panel — four U-slot bays that
// fill with GPU sleds (tinted by tier) as servers are installed; a status LED strip runs up the
// SW face. Load/health is legible from the world: cyan pulse when serving, red strobe when
// breaching, dark sleds when power/cooling can't keep all GPUs online.

import { RACK_SLOTS } from "../../../../game/config";
import type { Placed } from "../../../../game/types";
import type { Point } from "../../../../iso";
import { mix, tierColor, withAlpha, type Palette } from "../palette";
import { HW, faceQuad, isoBox } from "../projection";
import { INSTALL_MS } from "../anim";
import { drawBoxBase, drawShadow, entityDims, fillPoly, groundGlow, strokePoly } from "./common";

export interface RackView {
  now: number;
  selected: boolean;
  hovered: boolean;
  /** 0..1 share of this rack's GPUs actually online (facility-wide haircut). */
  online: number;
  serving: boolean;
  breaching: boolean;
  /** ms since last GPU install, or null — drives the sled slide-in flash. */
  installT: number | null;
}

function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 0) % 1000;
}

export function drawRack(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed, v: RackView): void {
  const { s, h } = entityDims(p);
  const gpus = p.gpus ?? 0;
  const tint = tierColor(pal, p.gpuType);
  const onlineCount = Math.round(gpus * v.online);
  const phase = hashPhase(p.id);

  if (gpus > 0) groundGlow(ctx, c, tint, HW * 1.9, v.serving ? 0.14 : 0.09);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  // tier-tinted cabinet so each compute hub carries its GPU color from any angle
  drawBoxBase(ctx, pal, box, {
    selected: v.selected,
    hovered: v.hovered,
    l: gpus > 0 ? mix(tint, "#0e1330", 0.82) : "#161c44",
    r: gpus > 0 ? mix(tint, "#161d3e", 0.74) : "#1b2350",
    t: gpus > 0 ? mix(tint, "#222a62", 0.6) : "#283168",
  });

  // bright bezel frame around the front (right) face — reads as a premium server door
  const bezel = faceQuad(box.s, box.e, 0.06, 3.5, 0.94, h - 2.5);
  strokePoly(ctx, bezel, withAlpha(tint, gpus > 0 ? 0.55 : 0.25), 1);

  // --- front panel (right face): 4 U-slot bays, bottom-up ------------------------------------
  // face top edge runs S→E; bays sit between d=5 and d=h-3
  const bayH = (h - 9) / RACK_SLOTS;
  for (let i = 0; i < RACK_SLOTS; i++) {
    const slot = RACK_SLOTS - 1 - i; // draw top-down, fill bottom-up
    const filled = slot < gpus;
    const d0 = 5 + i * bayH;
    const d1 = d0 + bayH - 1.6;
    // slide-in animation for the most recent sled
    let t0 = 0.14;
    let t1 = 0.86;
    let flash = 0;
    if (filled && slot === gpus - 1 && v.installT !== null) {
      const u = Math.min(1, v.installT / INSTALL_MS);
      const ease = 1 - (1 - u) * (1 - u);
      t0 = 0.14 + (1 - ease) * 0.5;
      t1 = 0.86 + (1 - ease) * 0.1;
      flash = 1 - u;
    }
    const q = faceQuad(box.s, box.e, t0, d0, t1, d1);
    if (!filled) {
      fillPoly(ctx, q, "rgba(0,0,0,0.42)");
      strokePoly(ctx, q, "rgba(255,255,255,0.05)", 0.6);
      continue;
    }
    const dead = slot >= onlineCount;
    fillPoly(ctx, q, dead ? "#2a1f33" : withAlpha(tint, 0.62));
    // bright inner light bar — the sled glows with its tier color
    if (!dead) {
      const lit = faceQuad(box.s, box.e, t0 + 0.04, d0 + 1, t1 - 0.18, d0 + bayH - 2.8);
      fillPoly(ctx, lit, withAlpha(mix(tint, "#ffffff", 0.4), v.serving ? 0.5 : 0.32));
    }
    strokePoly(ctx, q, dead ? withAlpha(pal.red, 0.4) : withAlpha(tint, 0.95), 0.8);
    if (flash > 0) fillPoly(ctx, q, withAlpha("#ffffff", flash * 0.5));
    // sled activity LED at the right end of the bay
    const ledOn = !dead && v.serving;
    const blink = ledOn ? 0.45 + 0.55 * Math.abs(Math.sin((v.now + phase * 7 + slot * 230) / 260)) : 0.18;
    const led = faceQuad(box.s, box.e, 0.80, d0 + 1.2, 0.84, d0 + 2.8);
    fillPoly(ctx, led, dead ? withAlpha(pal.red, 0.5) : withAlpha(ledOn ? pal.cyanHi : pal.fgDim, blink));
  }

  // --- status strip (left face) ---------------------------------------------------------------
  let stripColor = pal.fgDim; // idle
  let stripAlpha = 0.4;
  if (v.breaching && v.serving) {
    stripColor = pal.red;
    stripAlpha = Math.sin(v.now / 110) > 0 ? 0.95 : 0.25; // strobe
  } else if (v.serving && gpus > 0) {
    stripColor = pal.cyan;
    stripAlpha = 0.55 + 0.4 * Math.abs(Math.sin((v.now + phase * 3) / 420));
  } else if (gpus > 0) {
    stripColor = pal.amber;
    stripAlpha = 0.45;
  }
  const strip = faceQuad(box.w, box.s, 0.12, 4, 0.2, h - 4);
  fillPoly(ctx, strip, withAlpha(stripColor, stripAlpha));

  // vents on the left face
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    const q = faceQuad(box.w, box.s, 0.34 + i * 0.18, 6, 0.44 + i * 0.18, h - 6);
    ctx.beginPath();
    ctx.moveTo(q[0].x, q[0].y);
    ctx.lineTo(q[3].x, q[3].y);
    ctx.stroke();
  }

  // holographic scanline sweeping down the front panel
  if (gpus > 0) {
    const su = ((v.now + phase * 9) / 2300) % 1;
    const sd = 4 + su * (h - 8);
    const scan = faceQuad(box.s, box.e, 0.06, sd, 0.94, sd + 1.4);
    fillPoly(ctx, scan, withAlpha(tint, 0.2 * (1 - su * 0.5)));
  }

  // serving halo — a soft data-aura ring floating over the cabinet
  if (v.serving && gpus > 0 && !v.breaching) {
    const ha = 0.25 + 0.15 * Math.sin((v.now + phase * 5) / 480);
    ctx.save();
    ctx.strokeStyle = withAlpha(tint, ha);
    ctx.shadowColor = tint;
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse((box.n.x + box.s.x) / 2, c.y - h - 5, 8.5, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- top face: tier-tinted roof vent + policy chip + GPU count -------------------------------
  // a glowing intake vent strip across the roof, tinted by GPU tier
  if (gpus > 0) {
    for (let i = 0; i < 3; i++) {
      const t = 0.32 + i * 0.16;
      const a = { x: box.n.x + (box.e.x - box.n.x) * t, y: box.n.y + (box.e.y - box.n.y) * t };
      const b = { x: box.w.x + (box.s.x - box.w.x) * t, y: box.w.y + (box.s.y - box.w.y) * t };
      ctx.strokeStyle = withAlpha(tint, 0.4 + 0.2 * Math.abs(Math.sin((v.now + phase * 6) / 700 + i)));
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  const isLat = (p.policy ?? "throughput") === "latency";
  const chipC = { x: (box.n.x + box.w.x) / 2, y: (box.n.y + box.w.y) / 2 + 1 };
  ctx.fillStyle = withAlpha(isLat ? pal.green : pal.blue, 0.9);
  ctx.beginPath();
  ctx.arc(chipC.x, chipC.y, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "700 5px 'IBM Plex Mono', monospace";
  ctx.fillStyle = withAlpha(pal.fg, 0.85);
  ctx.fillText(isLat ? "LAT" : "THR", chipC.x + 3.4, chipC.y + 1.8);
  if (gpus > 0) {
    ctx.font = "700 6px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = withAlpha(pal.fg, 0.8);
    ctx.fillText(`${gpus}×`, (box.n.x + box.e.x) / 2 + 6, (box.n.y + box.e.y) / 2 + 3);
    ctx.textAlign = "start";
  }
}
