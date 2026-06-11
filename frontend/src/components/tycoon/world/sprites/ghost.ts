// Hover feedback: translucent placement ghost (cyan dashed = valid, red = blocked) with a cost
// label for build tools; a red ring + refund label over the hovered occupant for the sell tool;
// a subtle rim for the cursor tool.

import { COOLING_TIERS, CREWPOD, GPU_TIERS, NETWORK_TIERS, POWER_TIERS, RACK_CAPEX, SELL_REFUND } from "../../../../game/config";
import type { Placed, PlaceableKind } from "../../../../game/types";
import { fmt } from "../../../../format";
import type { Point } from "../../../../iso";
import { withAlpha, type Palette } from "../palette";
import { diamond, isoBox } from "../projection";
import { entityDims, fillPoly, strokePoly } from "./common";

const GHOST_DIMS: Record<PlaceableKind, { s: number; h: number }> = {
  power: { s: 0.62, h: 20 },
  cooling: { s: 0.72, h: 26 },
  rack: { s: 0.78, h: 34 },
  network: { s: 0.66, h: 22 },
  crewpod: { s: 0.74, h: 20 },
};

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  kind: PlaceableKind,
  c: Point,
  ok: boolean,
  cost: number,
): void {
  const { s, h } = GHOST_DIMS[kind];
  const box = isoBox(c, s, h);
  const tone = ok ? pal.cyan : pal.red;
  fillPoly(ctx, box.left, withAlpha(tone, 0.08));
  fillPoly(ctx, box.right, withAlpha(tone, 0.12));
  fillPoly(ctx, box.top, withAlpha(tone, 0.16));
  ctx.setLineDash([3, 2]);
  strokePoly(ctx, box.top, withAlpha(tone, 0.85), 1.2);
  strokePoly(ctx, diamond(c, 1.0), withAlpha(tone, 0.5), 1);
  ctx.setLineDash([]);
  ctx.font = "700 7px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(ok ? pal.fg : pal.red, 0.95);
  ctx.fillText(`−${fmt.money(cost)}`, c.x, c.y - h - 7);
  ctx.textAlign = "start";
}

function sellRefund(p: Placed): number {
  const capex =
    p.kind === "power"
      ? POWER_TIERS[p.tier ?? 0].capex
      : p.kind === "cooling"
        ? COOLING_TIERS[p.tier ?? 0].capex
        : p.kind === "network"
          ? NETWORK_TIERS[p.tier ?? 0].capex
          : p.kind === "crewpod"
            ? CREWPOD.capex
            : RACK_CAPEX + (p.gpus ?? 0) * GPU_TIERS[p.gpuType ?? "h100"].capex;
  return capex * SELL_REFUND;
}

export function drawSellMark(ctx: CanvasRenderingContext2D, pal: Palette, c: Point, p: Placed): void {
  const { h } = entityDims(p);
  ctx.setLineDash([4, 3]);
  strokePoly(ctx, diamond(c, 1.04), withAlpha(pal.red, 0.9), 1.6);
  ctx.setLineDash([]);
  ctx.font = "700 7px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(pal.green, 0.95);
  ctx.fillText(`+${fmt.money(sellRefund(p))}`, c.x, c.y - h - 7);
  ctx.textAlign = "start";
}

export function drawHoverRim(ctx: CanvasRenderingContext2D, pal: Palette, c: Point): void {
  strokePoly(ctx, diamond(c, 1.0), withAlpha(pal.cyan, 0.35), 1);
}
