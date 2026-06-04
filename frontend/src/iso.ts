// Pure isometric projection + datacenter-floor layout. No React, no DOM — just math over a grid,
// so it's easy to reason about (and to unit-test later). The floor is a grid of (col,row) cells;
// each GPU is one cell drawn as a small isometric block. Instances are laid out as adjacent racks;
// idle/unallocated GPUs form a separate "free pool" block.

export const TILE_W = 46; // projected width of a tile's top face (px)
export const TILE_H = 23; // projected height — 2:1 isometric
export const TILE_DEPTH = 13; // block thickness (px) for the faux-3D look
export const RACK_COLS = 4; // GPUs per row within a rack block

export interface Point {
  x: number;
  y: number;
}

export type TileKind = "gpu" | "free";

export interface FloorTile {
  col: number;
  row: number;
  kind: TileKind;
  instanceId: string | null; // null for free-pool tiles
  center: Point;
}

export interface FloorGroup {
  instanceId: string | null; // null = free pool
  label: string;
  count: number;
  anchor: Point; // label anchor (back of the block)
}

export interface FloorLayout {
  groups: FloorGroup[];
  tiles: FloorTile[]; // all tiles, sorted back-to-front for painter's-order drawing
  viewBox: string;
}

export interface InstanceLike {
  instance_id: string;
  gpu_count: number;
}

/** Project a grid cell (col,row) to the screen-space center of its top face. */
export function project(col: number, row: number): Point {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

/** SVG points for the top (diamond) face centered at p. */
export function topFace(p: Point): string {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return `${p.x},${p.y - hh} ${p.x + hw},${p.y} ${p.x},${p.y + hh} ${p.x - hw},${p.y}`;
}

/** Left vertical face of the block (gives the tile depth). */
export function leftFace(p: Point, depth: number = TILE_DEPTH): string {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return `${p.x - hw},${p.y} ${p.x},${p.y + hh} ${p.x},${p.y + hh + depth} ${p.x - hw},${p.y + depth}`;
}

/** Right vertical face of the block. */
export function rightFace(p: Point, depth: number = TILE_DEPTH): string {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return `${p.x + hw},${p.y} ${p.x},${p.y + hh} ${p.x},${p.y + hh + depth} ${p.x + hw},${p.y + depth}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Tile hue by KV-cache pressure: healthy green (low) → amber → hot red (saturated). */
export function heatColor(kvPressure: number): string {
  const p = Math.max(0, Math.min(1, kvPressure));
  const green = [74, 222, 128];
  const amber = [251, 191, 36];
  const red = [248, 113, 113];
  const [from, to, t] = p < 0.5 ? [green, amber, p / 0.5] : [amber, red, (p - 0.5) / 0.5];
  const r = Math.round(lerp(from[0], to[0], t));
  const g = Math.round(lerp(from[1], to[1], t));
  const b = Math.round(lerp(from[2], to[2], t));
  return `rgb(${r},${g},${b})`;
}

function blockRows(count: number): number {
  return Math.max(1, Math.ceil(count / RACK_COLS));
}

/** Lay every instance's GPUs (plus a free pool) onto the floor and compute a fit-to-content viewBox. */
export function layoutFloor(instances: InstanceLike[], freeCount: number): FloorLayout {
  const groups: FloorGroup[] = [];
  const tiles: FloorTile[] = [];
  let rowCursor = 0;

  const place = (id: string | null, label: string, count: number, kind: TileKind): void => {
    for (let i = 0; i < count; i++) {
      const col = i % RACK_COLS;
      const row = rowCursor + Math.floor(i / RACK_COLS);
      tiles.push({ col, row, kind, instanceId: id, center: project(col, row) });
    }
    groups.push({ instanceId: id, label, count, anchor: project(0, rowCursor) });
    rowCursor += blockRows(count) + 1; // gap row after each block
  };

  for (const inst of instances) place(inst.instance_id, inst.instance_id, inst.gpu_count, "gpu");
  if (freeCount > 0) {
    rowCursor += 1; // a wider gap before the unallocated pool
    place(null, "free pool", freeCount, "free");
  }

  // Fit-to-content viewBox so the floor auto-centers regardless of GPU count.
  const PAD = 44;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    minX = Math.min(minX, t.center.x - TILE_W / 2);
    maxX = Math.max(maxX, t.center.x + TILE_W / 2);
    minY = Math.min(minY, t.center.y - TILE_H / 2);
    maxY = Math.max(maxY, t.center.y + TILE_H / 2 + TILE_DEPTH);
  }
  for (const g of groups) {
    minX = Math.min(minX, g.anchor.x - TILE_W);
    minY = Math.min(minY, g.anchor.y - TILE_H - 18); // labels sit above the block
  }
  if (!Number.isFinite(minX)) {
    minX = -TILE_W;
    maxX = TILE_W;
    minY = -TILE_H;
    maxY = TILE_H;
  }
  const x = minX - PAD;
  const y = minY - PAD;
  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;

  // Painter's order: draw lower (greater screen-y) tiles last so depth overlaps read correctly.
  tiles.sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x);

  return { groups, tiles, viewBox: `${x} ${y} ${w} ${h}` };
}
