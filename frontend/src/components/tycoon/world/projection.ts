// World-space isometric geometry for the tycoon renderer. Extends the pure math in src/iso.ts
// (same projection, same tile metrics) with the inverse transform, extruded-box helpers, and the
// fixed hall/building geometry. Everything here is camera-agnostic world coordinates in px.

import { GRID_COLS, GRID_ROWS } from "../../../game/config";
import { TILE_H, TILE_W, project, type Point } from "../../../iso";

export const HW = TILE_W / 2;
export const HH = TILE_H / 2;

/** project() for fractional tile coordinates (tile centers sit at integer (col,row)). */
export function projectF(c: number, r: number): Point {
  return { x: (c - r) * HW, y: (c + r) * HH };
}

/** Screen-center of a tile's top face — re-exported from iso.ts for locality. */
export const tileCenter = project;

/** Exact inverse of project(): world point → fractional tile coords. */
export function unproject(x: number, y: number): { c: number; r: number } {
  return { c: (x / HW + y / HH) / 2, r: (y / HH - x / HW) / 2 };
}

/** The tile whose top-face diamond contains the world point (rounding IS the containment test). */
export function tileAt(x: number, y: number): { col: number; row: number } {
  const { c, r } = unproject(x, y);
  return { col: Math.round(c), row: Math.round(r) };
}

/** N,E,S,W corners of a tile-top diamond centered at c, scaled by s. */
export function diamond(c: Point, s = 1): Point[] {
  return [
    { x: c.x, y: c.y - HH * s },
    { x: c.x + HW * s, y: c.y },
    { x: c.x, y: c.y + HH * s },
    { x: c.x - HW * s, y: c.y },
  ];
}

export function pathPoly(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

export function pointInPoly(x: number, y: number, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** An extruded iso box whose TOP face is the tile diamond (scaled s) lifted by h px. */
export interface IsoBox {
  n: Point;
  e: Point;
  s: Point;
  w: Point;
  h: number;
  top: Point[];
  /** SW-facing vertical face (screen left). */
  left: Point[];
  /** SE-facing vertical face (screen right). */
  right: Point[];
}

export function isoBox(center: Point, s: number, h: number): IsoBox {
  const [n, e, so, w] = diamond({ x: center.x, y: center.y - h }, s);
  const dn = (p: Point): Point => ({ x: p.x, y: p.y + h });
  return {
    n,
    e,
    s: so,
    w,
    h,
    top: [n, e, so, w],
    left: [w, so, dn(so), dn(w)],
    right: [so, e, dn(e), dn(so)],
  };
}

/**
 * A sub-rectangle of a vertical box face. `from`→`to` is the face's TOP edge; t is the 0..1
 * position along it and d measures px straight down. Used to draw sleds/louvers/stripes that
 * stay glued to a face at any zoom.
 */
export function faceQuad(from: Point, to: Point, t0: number, d0: number, t1: number, d1: number): Point[] {
  const at = (t: number, d: number): Point => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t + d,
  });
  return [at(t0, d0), at(t1, d0), at(t1, d1), at(t0, d1)];
}

// --- the hall (fixed world geometry) ---------------------------------------------------------

export const COLS = GRID_COLS;
export const ROWS = GRID_ROWS;
export const WALL_H = 44; // back perimeter walls
export const LOW_WALL_H = 9; // cutaway front walls (the RCT trick)
export const APRON = 2.1; // tiles of concrete apron around the hall

/** The NW wall has a cable gap at this row — the fiber uplink enters the hall here. */
export const UPLINK_ROW = 2.5;
export const UPLINK_POS = projectF(-2.1, UPLINK_ROW); // pylon, out on the apron
export const UPLINK_GAP = projectF(-0.55, UPLINK_ROW); // where request packets enter

export interface HallCorners {
  top: Point;
  right: Point;
  bottom: Point;
  left: Point;
}

/** Outer corners of the buildable floor diamond (tile edges, not centers). */
export function hallCorners(): HallCorners {
  return {
    top: projectF(-0.5, -0.5),
    right: projectF(COLS - 0.5, -0.5),
    bottom: projectF(COLS - 0.5, ROWS - 0.5),
    left: projectF(-0.5, ROWS - 0.5),
  };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** World extent (hall + apron + wall height) — used for camera clamping and fit. */
export function worldBounds(): Bounds {
  const a = APRON + 0.9;
  const corners = [
    projectF(-0.5 - a, -0.5 - a),
    projectF(COLS - 0.5 + a, -0.5 - a),
    projectF(COLS - 0.5 + a, ROWS - 0.5 + a),
    projectF(-0.5 - a, ROWS - 0.5 + a),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY: minY - WALL_H, maxX, maxY };
}
