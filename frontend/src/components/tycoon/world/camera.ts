// Pan/zoom camera over the world. cam (x,y) is the WORLD point at the viewport center; the
// renderer applies translate(vw/2,vh/2) · scale(zoom) · translate(-x,-y) each frame.

import type { Point } from "../../../iso";
import { worldBounds } from "./projection";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 1.1;
export const MAX_ZOOM = 6;

export function screenToWorld(cam: Camera, vw: number, vh: number, sx: number, sy: number): Point {
  return { x: cam.x + (sx - vw / 2) / cam.zoom, y: cam.y + (sy - vh / 2) / cam.zoom };
}

export function clampCamera(cam: Camera): Camera {
  const b = worldBounds();
  return {
    x: Math.min(b.maxX, Math.max(b.minX, cam.x)),
    y: Math.min(b.maxY, Math.max(b.minY, cam.y)),
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom)),
  };
}

/** Zoom keeping the world point under the cursor fixed on screen. */
export function zoomAt(cam: Camera, vw: number, vh: number, sx: number, sy: number, factor: number): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
  const before = screenToWorld(cam, vw, vh, sx, sy);
  const after = { x: cam.x + (sx - vw / 2) / zoom, y: cam.y + (sy - vh / 2) / zoom };
  return clampCamera({ x: cam.x + (before.x - after.x), y: cam.y + (before.y - after.y), zoom });
}

/** Initial framing: the whole building with a little breathing room. */
export function fitToHall(vw: number, vh: number): Camera {
  const b = worldBounds();
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(vw / w, vh / h) * 0.95));
  return clampCamera({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 + 6, zoom });
}
