import { useMemo } from "react";

import {
  type FloorTile,
  heatColor,
  layoutFloor,
  leftFace,
  rightFace,
  topFace,
} from "../iso";
import type { InstanceView } from "../types";

interface DatacenterFloorProps {
  instances: InstanceView[];
  freeGpus: Record<string, number>;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
}

/** The cluster drawn as physical hardware: each instance is a rack of GPU tiles that glow with
 *  utilization and tint with KV-cache pressure; unallocated GPUs sit in a dim free pool. */
export function DatacenterFloor({ instances, freeGpus, selectedId, onSelect }: DatacenterFloorProps) {
  const totalFree = Object.values(freeGpus).reduce((a, b) => a + b, 0);

  const byId = useMemo(() => {
    const m = new Map<string, InstanceView>();
    for (const inst of instances) m.set(inst.instance_id, inst);
    return m;
  }, [instances]);

  const layout = useMemo(
    () =>
      layoutFloor(
        instances.map((i) => ({ instance_id: i.instance_id, gpu_count: i.gpu_count })),
        totalFree,
      ),
    [instances, totalFree],
  );

  return (
    <div className="floor">
      <svg className="floor-svg" viewBox={layout.viewBox} preserveAspectRatio="xMidYMid meet">
        {layout.tiles.map((tile) => (
          <Tile
            key={`${tile.col}:${tile.row}`}
            tile={tile}
            view={tile.instanceId ? byId.get(tile.instanceId) : undefined}
            selected={tile.instanceId != null && tile.instanceId === selectedId}
            onSelect={onSelect}
          />
        ))}
        {layout.groups.map((g) => {
          const view = g.instanceId ? byId.get(g.instanceId) : undefined;
          const sub = g.instanceId
            ? `${g.count}× ${view?.gpu_name ?? "GPU"}`
            : `${g.count} idle`;
          return (
            <text
              key={g.instanceId ?? "free"}
              className={"floor-label" + (g.instanceId === selectedId ? " sel" : "")}
              x={g.anchor.x}
              y={g.anchor.y - 16}
              textAnchor="middle"
            >
              <tspan className="floor-label-name">{g.label}</tspan>
              <tspan className="floor-label-sub" dx="6">
                {sub}
              </tspan>
            </text>
          );
        })}
      </svg>
      <div className="floor-legend">
        <span>
          <i className="swatch" style={{ background: heatColor(0.1) }} /> healthy
        </span>
        <span>
          <i className="swatch" style={{ background: heatColor(0.6) }} /> busy
        </span>
        <span>
          <i className="swatch" style={{ background: heatColor(1) }} /> KV saturated
        </span>
        <span>
          <i className="swatch free" /> idle / free
        </span>
        <span className="floor-hint">brightness = utilization · click a rack to inspect</span>
      </div>
    </div>
  );
}

interface TileProps {
  tile: FloorTile;
  view: InstanceView | undefined;
  selected: boolean;
  onSelect: (instanceId: string | null) => void;
}

function Tile({ tile, view, selected, onSelect }: TileProps) {
  const isFree = tile.kind === "free";
  const util = view?.gpu_util ?? 0;
  const kv = view?.kv_pressure ?? 0;
  const top = topFace(tile.center);
  const litOpacity = 0.18 + 0.82 * util; // idle racks stay dim; busy ones blaze

  return (
    <g
      className={"tile " + (isFree ? "free" : "gpu") + (selected ? " sel" : "")}
      onClick={() => onSelect(tile.instanceId)}
    >
      <polygon className="face-left" points={leftFace(tile.center)} />
      <polygon className="face-right" points={rightFace(tile.center)} />
      <polygon className="face-top base" points={top} />
      {!isFree && <polygon className="face-top lit" points={top} fill={heatColor(kv)} opacity={litOpacity} />}
      <polygon className="face-top edge" points={top} />
    </g>
  );
}
