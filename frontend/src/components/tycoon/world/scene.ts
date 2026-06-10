// The draw pipeline, painter's order: backdrop is screen-space (WorldCanvas), then inside the
// camera transform — apron → back walls → floor (heat/cool glows) → hover/ghost → entities
// (y-sorted) → front cutaway walls → particles. Screen-space overlays (vignette, strain, paused)
// come last via drawOverlays.

import { inBounds } from "../../../game/engine";
import type { Placed, PlaceableKind } from "../../../game/types";
import {
  anyBreaching,
  fracOnline,
  placeValidity,
  tileOccupant,
} from "../selectors";
import { AnimTracker, BORN_MS, REMOVE_MS } from "./anim";
import type { FxSystem } from "./fx";
import { withAlpha, type Palette } from "./palette";
import { tileCenter } from "./projection";
import { drawSelectionRing } from "./sprites/common";
import { drawCooling } from "./sprites/cooling";
import {
  drawApron,
  drawBackWalls,
  drawFloorTiles,
  drawFrontWalls,
} from "./sprites/floor";
import { drawGhost, drawHoverRim, drawSellMark } from "./sprites/ghost";
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
): void {
  const { state, stats } = frame;
  const online = fracOnline(stats);
  const breaching = anyBreaching(state);
  const serving = stats.served > 0.5;

  drawApron(ctx);
  drawBackWalls(ctx, pal, now);
  drawFloorTiles(ctx, pal, state, online);

  // hover feedback under the entities
  const tool = state.tool;
  if (hover && inBounds(hover.col, hover.row)) {
    const c = tileCenter(hover.col, hover.row);
    const occ = tileOccupant(state, hover.col, hover.row);
    if (tool === "power" || tool === "cooling" || tool === "rack") {
      const v = placeValidity(state, tool as PlaceableKind, hover.col, hover.row);
      drawGhost(ctx, pal, tool as PlaceableKind, c, v.ok, v.cost);
    } else if (tool === "sell" && occ) {
      drawSellMark(ctx, pal, c, occ);
    } else if (tool === "cursor" && !occ) {
      drawHoverRim(ctx, pal, c);
    }
  }

  // entities, y-sorted (col+row asc ≡ screen-y asc), with born/install animation transforms
  const sorted = [...state.placed].sort((a, b) => a.col + a.row - (b.col + b.row) || a.col - b.col);
  for (const p of sorted) {
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
    drawEntity(ctx, pal, p, c, {
      now,
      selected,
      hovered,
      online,
      serving,
      breaching,
      installT: p.kind === "rack" ? anims.installT(p.id, now) : null,
    });
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
    drawPower(ctx, pal, c, p, { now: v.now, selected: v.selected, hovered: v.hovered });
  } else {
    drawCooling(ctx, pal, c, p, { now: v.now, selected: v.selected, hovered: v.hovered });
  }
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
