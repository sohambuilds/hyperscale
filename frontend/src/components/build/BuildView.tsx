import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { TILE_H, TILE_W, type Point, topFace } from "../../iso";
import { GRID_COLS, GRID_ROWS, GPU_TIERS } from "../../game/config";
import { computeStats } from "../../game/engine";
import type { GameState, Placed, Tool } from "../../game/types";

interface BuildViewProps {
  state: GameState;
  onTapTile: (col: number, row: number) => void;
}

interface Cell {
  col: number;
  row: number;
  center: Point;
}

const HW = TILE_W / 2;
const HH = TILE_H / 2;
const GAP = 18;
const FOOT = 0.78;
const BW = HW * FOOT;
const BH = HH * FOOT;

const placeCenter = (col: number, row: number): Point => ({
  x: (col - row) * (HW + GAP),
  y: (col + row) * (HH + GAP / 2),
});

type P2 = [number, number];
const poly = (a: P2[]): string => a.map((p) => p.join(",")).join(" ");

function prism(center: Point, h: number): { top: string; left: string; right: string } {
  const tx = center.x;
  const ty = center.y - h;
  return {
    top: poly([[tx, ty - BH], [tx + BW, ty], [tx, ty + BH], [tx - BW, ty]]),
    right: poly([[tx + BW, ty], [tx, ty + BH], [center.x, center.y + BH], [center.x + BW, center.y]]),
    left: poly([[tx - BW, ty], [tx, ty + BH], [center.x, center.y + BH], [center.x - BW, center.y]]),
  };
}

const HEIGHT: Record<string, number> = { power: 15, cooling: 13, rack: 24 };
const GLOW: Record<string, string> = { power: "251,191,36", cooling: "96,165,250", rack: "34,211,238" };
const isBuildTool = (t: Tool): boolean => t === "power" || t === "cooling" || t === "rack";

export function BuildView({ state, onTapTile }: BuildViewProps) {
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const panned = useRef(false);

  const { cells, viewBox, uplink, vbScale } = useMemo(() => {
    const cs: Cell[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) cs.push({ col, row, center: placeCenter(col, row) });
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of cs) {
      minX = Math.min(minX, c.center.x - HW);
      maxX = Math.max(maxX, c.center.x + HW);
      minY = Math.min(minY, c.center.y - HH - 40);
      maxY = Math.max(maxY, c.center.y + HH + 8);
    }
    const PAD = 28;
    cs.sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x);
    const w = maxX - minX + PAD * 2;
    return {
      cells: cs,
      viewBox: `${minX - PAD} ${minY - PAD} ${w} ${maxY - minY + PAD * 2}`,
      uplink: { x: (minX + maxX) / 2, y: minY - 14 } as Point,
      vbScale: w,
    };
  }, []);

  // wheel zoom (non-passive so it doesn't scroll the page)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({ ...v, z: Math.max(0.6, Math.min(2.4, v.z * (e.deltaY < 0 ? 1.12 : 0.89))) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    panned.current = false;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const el = svgRef.current;
    const k = el ? vbScale / el.clientWidth / view.z : 1;
    const dx = (e.clientX - d.x) * k;
    const dy = (e.clientY - d.y) * k;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) panned.current = true;
    setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const tap = (col: number, row: number) => {
    if (panned.current) return;
    onTapTile(col, row);
  };

  const byCell = useMemo(() => {
    const m = new Map<string, Placed>();
    for (const p of state.placed) m.set(`${p.col},${p.row}`, p);
    return m;
  }, [state.placed]);

  const centerOf = useMemo(() => {
    const m = new Map<string, Point>();
    for (const p of state.placed) m.set(p.id, placeCenter(p.col, p.row));
    return m;
  }, [state.placed]);

  const stats = useMemo(() => computeStats(state), [state]);
  const fracOnline = stats.gpus > 0 ? stats.gpusOnline / stats.gpus : 0;
  const load = stats.demand > 0 ? Math.min(1, stats.served / stats.demand) : fracOnline > 0 ? 0.4 : 0;
  const strain = stats.breached > 1;
  const runningRacks = state.placed.filter((p) => p.kind === "rack" && (p.gpus ?? 0) > 0 && fracOnline > 0);

  return (
    <div className="buildview" data-tut="build">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={"build-svg" + (drag.current ? " panning" : "")}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.z})`}>
          {/* data-flow: running racks → uplink */}
          {runningRacks.map((r) => {
            const c = centerOf.get(r.id);
            if (!c) return null;
            return (
              <line
                key={"flow-" + r.id}
                className="flow"
                x1={c.x}
                y1={c.y - HEIGHT.rack}
                x2={uplink.x}
                y2={uplink.y}
                style={{ opacity: 0.25 + 0.6 * load, animationDuration: `${0.8 - 0.4 * load}s` }}
              />
            );
          })}

          {/* uplink beacon */}
          <g className="uplink">
            <circle className="uplink-glow" cx={uplink.x} cy={uplink.y} r={9} style={{ opacity: 0.3 + 0.6 * load }} />
            <circle className="uplink-core" cx={uplink.x} cy={uplink.y} r={4} />
            <text className="uplink-label" x={uplink.x} y={uplink.y - 14} textAnchor="middle">
              UPLINK
            </text>
          </g>

          {cells.map((cell) => {
            const occ = byCell.get(`${cell.col},${cell.row}`);
            const selected = occ != null && occ.id === state.selectedId;
            const isHover = hover?.col === cell.col && hover?.row === cell.row;
            const showGhost = isHover && isBuildTool(state.tool) && !occ;
            return (
              <g
                key={`${cell.col},${cell.row}`}
                className={"cell" + (occ ? " filled" : " empty")}
                onClick={() => tap(cell.col, cell.row)}
                onMouseEnter={() => setHover({ col: cell.col, row: cell.row })}
                onMouseLeave={() => setHover((h) => (h?.col === cell.col && h?.row === cell.row ? null : h))}
              >
                <polygon className="plot" points={topFace(cell.center)} />
                {occ && (
                  <Building placed={occ} center={cell.center} selected={selected} load={load} strain={strain} online={fracOnline > 0} now={state.tick} />
                )}
                {showGhost && <Ghost center={cell.center} tool={state.tool} />}
                {!occ && !showGhost && isBuildTool(state.tool) && (
                  <text className="cell-plus" x={cell.center.x} y={cell.center.y + 4} textAnchor="middle">
                    +
                  </text>
                )}
              </g>
            );
          })}

          {/* floating feedback */}
          {state.fx.map((fx) => {
            const c = centerOf.get(fx.rackId);
            if (!c) return null;
            return (
              <text key={fx.id} className={"fx fx-" + fx.kind} x={c.x} y={c.y - HEIGHT.rack - 12} textAnchor="middle">
                {fx.text}
              </text>
            );
          })}
        </g>
      </svg>

      <div className="cam-controls">
        <button type="button" onClick={() => setView((v) => ({ ...v, z: Math.min(2.4, v.z * 1.15) }))} aria-label="zoom in">+</button>
        <button type="button" onClick={() => setView((v) => ({ ...v, z: Math.max(0.6, v.z * 0.87) }))} aria-label="zoom out">−</button>
        <button type="button" onClick={() => setView({ z: 1, tx: 0, ty: 0 })} aria-label="reset view">⊡</button>
      </div>
    </div>
  );
}

function Building({
  placed,
  center,
  selected,
  load,
  strain,
  online,
  now,
}: {
  placed: Placed;
  center: Point;
  selected: boolean;
  load: number;
  strain: boolean;
  online: boolean;
  now: number;
}) {
  const h = HEIGHT[placed.kind];
  const f = prism(center, h);
  const gpus = placed.gpus ?? 0;
  const isRack = placed.kind === "rack";
  const running = isRack ? gpus > 0 && online : true;
  const glow = GLOW[placed.kind];
  const intensity = isRack ? 0.3 + 0.7 * load : 1;
  const style: CSSProperties | undefined = running
    ? { filter: `drop-shadow(0 0 ${5 + 9 * intensity}px rgba(${glow},${0.35 + 0.3 * intensity}))` }
    : undefined;
  const topY = center.y - h;
  const fresh = now - (placed.bornAt ?? 0) < 2; // power-on flash on placement

  return (
    <g className={"bld bld-" + placed.kind + (selected ? " sel" : "") + (fresh ? " fresh" : "") + (isRack && strain && running ? " strain" : "")}>
      <ellipse className="bld-shadow" cx={center.x} cy={center.y + BH - 1} rx={BW * 0.95} ry={BH * 0.8} />
      <g style={style}>
        <polygon className="face-left" points={f.left} />
        <polygon className="face-right" points={f.right} />
        <polygon className="face-top" points={f.top} />
        <polygon className="face-rim" points={f.top} />
        {placed.kind === "power" && <PowerArt cx={center.x} cy={topY} />}
        {placed.kind === "cooling" && <CoolingArt cx={center.x} cy={topY} load={load} />}
        {isRack && <RackArt cx={center.x} baseY={center.y} gpus={gpus} online={online} />}
      </g>
      {isRack && (
        <text className="bld-count" x={center.x} y={center.y - h - BH - 5} textAnchor="middle">
          {gpus}/4 {GPU_TIERS[placed.gpuType ?? "h100"].name}
        </text>
      )}
    </g>
  );
}

function PowerArt({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <polygon className="power-cap" points={poly([[cx, cy - 4.5], [cx + 8, cy], [cx, cy + 4.5], [cx - 8, cy]])} />
      <circle className="power-core" cx={cx} cy={cy} r={4.5} />
      <path className="power-bolt" d={`M ${cx + 1} ${cy - 5.5} L ${cx - 3} ${cy} L ${cx} ${cy} L ${cx - 1} ${cy + 5.5} L ${cx + 3} ${cy - 1} L ${cx} ${cy - 1} Z`} />
    </g>
  );
}

function CoolingArt({ cx, cy, load }: { cx: number; cy: number; load: number }) {
  return (
    <g>
      <ellipse className="fan-housing" cx={cx} cy={cy} rx={10} ry={6} />
      <g className="fan-blades" style={{ transformBox: "fill-box", transformOrigin: "center", animationDuration: `${Math.max(0.5, 3.2 - 2.4 * load)}s` } as CSSProperties}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} className="fan-blade" x1={cx} y1={cy} x2={cx + 8 * Math.cos((i * Math.PI) / 2)} y2={cy + 4.7 * Math.sin((i * Math.PI) / 2)} />
        ))}
      </g>
      <circle className="fan-hub" cx={cx} cy={cy} r={1.8} />
    </g>
  );
}

function RackArt({ cx, baseY, gpus, online }: { cx: number; baseY: number; gpus: number; online: boolean }) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => {
        const y = baseY - 6 - i * 5.4;
        const lit = i < gpus;
        const w = 12;
        const blade: P2[] = [[cx, y - 2.6], [cx + w, y], [cx, y + 2.6], [cx - w, y]];
        return (
          <g key={i}>
            <polygon className={"blade" + (lit ? (online ? " lit" : " lit offline") : "")} points={poly(blade)} />
            {lit && online && (
              <>
                <circle className="led" cx={cx - 4.5} cy={y} r={1} style={{ animationDelay: `${i * 0.3}s` }} />
                <circle className="led" cx={cx + 4.5} cy={y} r={1} style={{ animationDelay: `${i * 0.3 + 0.7}s` }} />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Ghost({ center, tool }: { center: Point; tool: Tool }) {
  const f = prism(center, HEIGHT[tool] ?? 14);
  return (
    <g className="ghost">
      <polygon className="face-left" points={f.left} />
      <polygon className="face-right" points={f.right} />
      <polygon className="face-top" points={f.top} fill={`rgba(${GLOW[tool] ?? "34,211,238"},0.22)`} />
      <polygon className="face-rim" points={f.top} />
    </g>
  );
}
