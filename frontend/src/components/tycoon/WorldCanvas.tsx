// Full-viewport canvas world: one rAF loop (DPR-aware), pan/zoom camera, hover ghost, and click
// routing into the game. React state never drives the canvas — the latest {state, stats} arrives
// via frameRef and live callbacks via a game ref, so the loop mounts exactly once (StrictMode-
// safe: every listener/observer is torn down in cleanup).

import { useEffect, useRef, type MutableRefObject } from "react";

import { inBounds } from "../../game/engine";
import type { Game } from "../../game/useGame";
import type { GameState, Placed } from "../../game/types";
import { AnimTracker } from "./world/anim";
import {
  clampCamera,
  fitToHall,
  screenToWorld,
  zoomAt,
  type Camera,
} from "./world/camera";
import { FxSystem } from "./world/fx";
import { resolvePalette } from "./world/palette";
import { tileAt } from "./world/projection";
import { drawOverlays, drawScene } from "./world/scene";
import { drawBackdrop } from "./world/sprites/floor";
import { entityAt } from "./world/sprites/common";
import type { FrameData, HoverTile } from "./world/types";

interface WorldCanvasProps {
  game: Game;
  frameRef: MutableRefObject<FrameData>;
}

interface PanState {
  id: number;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  panning: boolean;
  button: number;
}

export function WorldCanvas({ game, frameRef }: WorldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  // camera survives StrictMode remounts and panel toggles
  const camRef = useRef<Camera | null>(null);
  const sizeRef = useRef({ vw: 0, vh: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pal = resolvePalette();
    const anims = new AnimTracker();
    const fx = new FxSystem();
    const hoverRef: { current: HoverTile | null } = { current: null };
    const panRef: { current: PanState | null } = { current: null };
    let raf = 0;
    let last = performance.now();
    let lastState: GameState | null = null;
    let servingRacks: Placed[] = [];

    const resize = (): void => {
      const vw = wrap.clientWidth;
      const vh = wrap.clientHeight;
      sizeRef.current = { vw, vh };
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(vw * dpr));
      const h = Math.max(1, Math.round(vh * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    if (!camRef.current) camRef.current = fitToHall(sizeRef.current.vw, sizeRef.current.vh);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - last);
      last = now;
      resize(); // also picks up devicePixelRatio drift from browser zoom
      const { vw, vh } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;

      const fd = frameRef.current;
      if (fd.state !== lastState) {
        anims.sync(fd.state, now);
        fx.syncGameFx(fd.state);
        servingRacks = fd.state.placed.filter((p) => p.kind === "rack" && (p.gpus ?? 0) > 0);
        lastState = fd.state;
      }
      fx.update(dt, fd.state.paused ? 0 : fd.stats.served, servingRacks);
      anims.prune(now);

      const cam = clampCamera(camRef.current ?? fitToHall(vw, vh));
      camRef.current = cam;
      // debug/testing affordance: lets tooling map world↔screen without reaching into React
      (canvas as HTMLCanvasElement & { __cam?: Camera }).__cam = cam;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdrop(ctx, pal, vw, vh);
      ctx.save();
      ctx.translate(vw / 2, vh / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);
      drawScene(ctx, fd, hoverRef.current, anims, fx, pal, now);
      ctx.restore();
      drawOverlays(ctx, fd, pal, vw, vh, now);

      const tool = fd.state.tool;
      canvas.style.cursor = panRef.current?.panning
        ? "grabbing"
        : tool === "cursor"
          ? "default"
          : "crosshair";
    };
    raf = requestAnimationFrame(frame);

    const localPoint = (e: { clientX: number; clientY: number }): { sx: number; sy: number } => {
      const r = canvas.getBoundingClientRect();
      return { sx: e.clientX - r.left, sy: e.clientY - r.top };
    };

    const onPointerDown = (e: PointerEvent): void => {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events have no active pointer — clicks still work without capture */
      }
      const { sx, sy } = localPoint(e);
      const cam = camRef.current;
      if (!cam) return;
      panRef.current = { id: e.pointerId, sx, sy, cx: cam.x, cy: cam.y, panning: false, button: e.button };
    };

    const onPointerMove = (e: PointerEvent): void => {
      const { sx, sy } = localPoint(e);
      const { vw, vh } = sizeRef.current;
      const cam = camRef.current;
      if (!cam) return;
      const pan = panRef.current;
      if (pan && pan.id === e.pointerId) {
        const dx = sx - pan.sx;
        const dy = sy - pan.sy;
        const tool = gameRef.current.state.tool;
        const panAllowed = pan.button === 1 || pan.button === 2 || tool === "cursor";
        if (!pan.panning && panAllowed && Math.hypot(dx, dy) > 5) pan.panning = true;
        if (pan.panning) {
          camRef.current = clampCamera({ x: pan.cx - dx / cam.zoom, y: pan.cy - dy / cam.zoom, zoom: cam.zoom });
          hoverRef.current = null;
          return;
        }
      }
      const w = screenToWorld(cam, vw, vh, sx, sy);
      hoverRef.current = tileAt(w.x, w.y);
    };

    const onPointerUp = (e: PointerEvent): void => {
      const pan = panRef.current;
      panRef.current = null;
      if (!pan || pan.id !== e.pointerId || pan.panning) return;
      if (e.button === 2) {
        gameRef.current.setTool("cursor"); // right-click cancels the active tool
        return;
      }
      if (e.button !== 0) return;
      const { sx, sy } = localPoint(e);
      const { vw, vh } = sizeRef.current;
      const cam = camRef.current;
      if (!cam) return;
      const w = screenToWorld(cam, vw, vh, sx, sy);
      const g = gameRef.current;
      const st = frameRef.current.state;
      // body hit first so clicking a tall cabinet doesn't land on the tile behind it
      const hit = entityAt(w.x, w.y, st.placed);
      if (st.tool === "cursor" && hit) {
        g.selectId(hit.id);
        return;
      }
      const t = hit ? { col: hit.col, row: hit.row } : tileAt(w.x, w.y);
      if (inBounds(t.col, t.row)) g.tapTile(t.col, t.row);
      else if (st.tool === "cursor") g.selectId(null);
    };

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const { sx, sy } = localPoint(e);
      const { vw, vh } = sizeRef.current;
      const cam = camRef.current;
      if (!cam) return;
      camRef.current = zoomAt(cam, vw, vh, sx, sy, Math.exp(-e.deltaY * 0.0012));
    };

    const onLeave = (): void => {
      hoverRef.current = null;
    };
    const onContextMenu = (e: Event): void => e.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
    // mount-once by design: live data flows through frameRef/gameRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = (factor: number): void => {
    const { vw, vh } = sizeRef.current;
    const cam = camRef.current;
    if (!cam) return;
    camRef.current = zoomAt(cam, vw, vh, vw / 2, vh / 2, factor);
  };
  const fit = (): void => {
    const { vw, vh } = sizeRef.current;
    camRef.current = fitToHall(vw, vh);
  };

  return (
    <div ref={wrapRef} className="tyc-canvas">
      <canvas ref={canvasRef} />
      <div className="cam-controls tyc-cam">
        <button type="button" onClick={() => zoomBy(1.3)} title="Zoom in" aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(0.77)} title="Zoom out" aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={fit} title="Fit view" aria-label="Fit view">
          ⛶
        </button>
      </div>
    </div>
  );
}
