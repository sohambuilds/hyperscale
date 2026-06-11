// The draw pipeline, painter's order: backdrop is screen-space (WorldCanvas), then inside the
// camera transform — apron → back walls → floor (heat/cool glows) → hover/ghost → entities
// (y-sorted) → front cutaway walls → particles. Screen-space overlays (vignette, strain, paused)
// come last via drawOverlays.

import { BUILD_MS } from "../../../game/config";
import { inBounds } from "../../../game/engine";
import type { Placed, PlaceableKind } from "../../../game/types";
import {
  anyBreaching,
  fracOnline,
  placeValidity,
  tileOccupant,
} from "../selectors";
import { AnimTracker, BORN_MS, REMOVE_MS } from "./anim";
import type { Actor } from "./figures";
import type { FxSystem } from "./fx";
import { withAlpha, type Palette } from "./palette";
import { isoBox, tileCenter } from "./projection";
import { drawBoxBase, drawSelectionRing, drawShadow, entityDims, fillPoly, strokePoly } from "./sprites/common";
import { drawCooling } from "./sprites/cooling";
import { drawCrewPod } from "./sprites/crewpod";
import {
  drawApron,
  drawBackWalls,
  drawFloorTiles,
  drawFrontWalls,
} from "./sprites/floor";
import { drawGhost, drawHoverRim, drawSellMark } from "./sprites/ghost";
import { drawNetwork } from "./sprites/network";
import { drawPower } from "./sprites/power";
import { drawRack } from "./sprites/rack";
import type { FrameData, HoverTile } from "./types";

function easeOutBack(u: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  frame: FrameData,
  hover: HoverTile | null,
  anims: AnimTracker,
  fx: FxSystem,
  pal: Palette,
  now: number,
  actors: Actor[] = [],
): void {
  const { state, stats } = frame;
  const online = fracOnline(stats);
  const breaching = anyBreaching(state);
  const serving = stats.served > 0.5;

  drawApron(ctx, pal, now);
  drawBackWalls(ctx, pal, now);
  drawFloorTiles(ctx, pal, state, online, now, fx.reduced);

  // hover feedback under the entities
  const tool = state.tool;
  if (hover && inBounds(hover.col, hover.row)) {
    const c = tileCenter(hover.col, hover.row);
    const occ = tileOccupant(state, hover.col, hover.row);
    if (tool === "power" || tool === "cooling" || tool === "rack" || tool === "network" || tool === "crewpod") {
      const v = placeValidity(state, tool as PlaceableKind, hover.col, hover.row);
      drawGhost(ctx, pal, tool as PlaceableKind, c, v.ok, v.cost);
    } else if (tool === "sell" && occ) {
      drawSellMark(ctx, pal, c, occ);
    } else if (tool === "cursor" && !occ) {
      drawHoverRim(ctx, pal, c);
    }
  }

  // Buildings AND people merged into one depth-sorted stream (anchor screen-y asc ≡ far→near), so a
  // technician walking behind a cabinet is painted before it and gets correctly occluded. Tile
  // anchor y = tileCenter().y = (col+row)*HH, the same units as an actor's feet y.
  type Drawable = { y: number; tie: number; p?: Placed; act?: Actor };
  const drawables: Drawable[] = [];
  for (const p of state.placed) drawables.push({ y: tileCenter(p.col, p.row).y, tie: p.col, p });
  for (const a of actors) drawables.push({ y: a.y, tie: Number.MAX_SAFE_INTEGER, act: a });
  drawables.sort((A, B) => A.y - B.y || A.tie - B.tie);

  for (const d of drawables) {
    if (d.act) {
      d.act.render(ctx);
      continue;
    }
    const p = d.p!;
    const c = tileCenter(p.col, p.row);
    const selected = state.selectedId === p.id;
    const hovered = tool === "cursor" && hover != null && hover.col === p.col && hover.row === p.row;
    if (selected) drawSelectionRing(ctx, pal, c, now);

    const bornT = anims.bornT(p.id, now);
    ctx.save();
    if (bornT !== null) {
      const u = bornT / BORN_MS;
      const s = 0.65 + 0.35 * easeOutBack(u);
      ctx.globalAlpha = Math.min(1, u * 2.5);
      ctx.translate(c.x, c.y);
      ctx.scale(s, s);
      ctx.translate(-c.x, -c.y - (1 - u) * 10);
    }
    if (p.buildMs != null && p.buildMs > 0) {
      const frac = Math.max(0, Math.min(1, 1 - p.buildMs / (BUILD_MS[p.kind] || 1)));
      drawConstruction(ctx, pal, p, c, frac, now);
    } else {
      drawEntity(ctx, pal, p, c, {
        now,
        selected,
        hovered,
        online,
        serving,
        breaching,
        installT: p.kind === "rack" ? anims.installT(p.id, now) : null,
      });
    }
    ctx.restore();
  }

  // sell/remove dust puffs
  for (const r of anims.removals) {
    const u = (now - r.at) / REMOVE_MS;
    if (u < 0 || u >= 1) continue;
    const c = tileCenter(r.col, r.row);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 4 + u * 18, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(pal.fgDim, 0.5 * (1 - u));
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawFrontWalls(ctx, pal);
  fx.draw(ctx, pal);
}

interface EntityView {
  now: number;
  selected: boolean;
  hovered: boolean;
  online: number;
  serving: boolean;
  breaching: boolean;
  installT: number | null;
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  p: Placed,
  c: { x: number; y: number },
  v: EntityView,
): void {
  // tier-1 prestige badge: a small gold star hovering above upgraded infrastructure
  if ((p.tier ?? 0) >= 1 && p.kind !== "rack") {
    const { h } = entityDims(p);
    const by = c.y - h - 15 + Math.sin(v.now / 900 + c.x) * 1.5;
    ctx.save();
    ctx.fillStyle = withAlpha(pal.gold, 0.9);
    ctx.shadowColor = pal.gold;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const aIn = a + Math.PI / 5;
      const R = 3.2;
      ctx.lineTo(c.x + Math.cos(a) * R, by + Math.sin(a) * R);
      ctx.lineTo(c.x + Math.cos(aIn) * R * 0.45, by + Math.sin(aIn) * R * 0.45);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const unit = { now: v.now, selected: v.selected, hovered: v.hovered };
  if (p.kind === "rack") {
    drawRack(ctx, pal, c, p, {
      now: v.now,
      selected: v.selected,
      hovered: v.hovered,
      online: v.online,
      serving: v.serving,
      breaching: v.breaching,
      installT: v.installT,
    });
  } else if (p.kind === "power") {
    drawPower(ctx, pal, c, p, unit);
  } else if (p.kind === "cooling") {
    drawCooling(ctx, pal, c, p, unit);
  } else if (p.kind === "network") {
    drawNetwork(ctx, pal, c, p, unit);
  } else {
    drawCrewPod(ctx, pal, c, p, unit);
  }
}

/** A building under construction: a rising body clipped to its progress, a dashed cyan permit
 *  wireframe, weld sparks at the build line, and a progress bar. Builders stand in front of it. */
function drawConstruction(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  p: Placed,
  c: { x: number; y: number },
  frac: number,
  now: number,
): void {
  const { s, h } = entityDims(p);
  drawShadow(ctx, c, s);
  const box = isoBox(c, s, h);
  const cutY = c.y - h * frac; // top of the built-so-far portion

  // rising solid, clipped to the built height
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x - 44, cutY, 88, 260);
  ctx.clip();
  drawBoxBase(ctx, pal, box, { l: "#141a28", r: "#192133", t: "#1b2438" });
  ctx.restore();

  // permit wireframe (full silhouette) + vertical edges, dashed cyan
  ctx.setLineDash([3, 2]);
  const wf = withAlpha(pal.cyan, 0.45);
  strokePoly(ctx, box.top, wf, 1);
  for (const [a, b] of [
    [box.w, { x: box.w.x, y: box.w.y + h }],
    [box.s, { x: box.s.x, y: box.s.y + h }],
    [box.e, { x: box.e.x, y: box.e.y + h }],
  ] as const) {
    ctx.strokeStyle = wf;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // weld sparks along the build line
  if (frac > 0.02 && frac < 0.99) {
    fillPoly(ctx, [
      { x: c.x - 14, y: cutY },
      { x: c.x + 14, y: cutY },
      { x: c.x + 14, y: cutY + 1 },
      { x: c.x - 14, y: cutY + 1 },
    ], withAlpha(pal.amber, 0.5));
    if (Math.sin(now / 90 + c.x) > 0.6) {
      ctx.fillStyle = withAlpha(pal.amber, 0.95);
      ctx.fillRect(c.x - 6 + Math.random() * 12, cutY - 1, 1, 1.5);
    }
  }

  // progress bar above
  const bw = 22;
  const bx = c.x - bw / 2;
  const by = c.y - h - 12;
  ctx.fillStyle = "rgba(8,12,20,0.85)";
  ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
  ctx.fillStyle = withAlpha(pal.cyan, 0.9);
  ctx.fillRect(bx, by, bw * frac, 2);
}

/** Screen-space layers: edge vignette, breach strain pulse, paused wash + tag. */
export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  frame: FrameData,
  pal: Palette,
  vw: number,
  vh: number,
  now: number,
): void {
  // vignette
  const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(4,6,11,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);

  // SLA strain — pulsing red inset glow on the edges
  if (anyBreaching(frame.state)) {
    const a = 0.10 + 0.07 * Math.sin(now / 280);
    const edge = Math.min(vw, vh) * 0.16;
    for (const [x0, y0, x1, y1] of [
      [0, 0, 0, edge],
      [0, vh, 0, vh - edge],
      [0, 0, edge, 0],
      [vw, 0, vw - edge, 0],
    ] as const) {
      const lg = ctx.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, withAlpha(pal.red, a));
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  // paused
  if (frame.state.paused && frame.state.status === "playing") {
    ctx.fillStyle = "rgba(7,9,15,0.28)";
    ctx.fillRect(0, 0, vw, vh);
    const label = "❚❚ PAUSED — time is stopped, build freely";
    ctx.font = "600 11px 'IBM Plex Mono', monospace";
    const w = ctx.measureText(label).width + 24;
    const x = vw / 2 - w / 2;
    const y = 64;
    ctx.fillStyle = "rgba(5,7,12,0.85)";
    ctx.strokeStyle = withAlpha(pal.cyan, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 26, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.fgMuted;
    ctx.textAlign = "center";
    ctx.fillText(label, vw / 2, y + 17);
    ctx.textAlign = "start";
  }
}
