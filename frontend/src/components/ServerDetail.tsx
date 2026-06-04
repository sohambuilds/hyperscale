import type { ReactNode } from "react";

import type { Catalog, InstanceView } from "../types";
import type { SessionControls } from "../useSession";
import { InfoTooltip } from "./InfoTooltip";

interface ServerDetailProps {
  instance: InstanceView | null;
  catalog: Catalog | null;
  totalFree: number;
  finished: boolean;
  controls: SessionControls;
}

const pct = (n: number): string => (n * 100).toFixed(0) + "%";
const tflops = (flops: number): string => (flops / 1e12).toFixed(0) + " TFLOP/s";
const paramStr = (n: number): string =>
  n >= 1e9 ? (n / 1e9).toFixed(0) + "B" : (n / 1e6).toFixed(0) + "M";

/** Spec sheet + live readout + GPU stepper for the rack selected on the floor. */
export function ServerDetail({ instance, catalog, totalFree, finished, controls }: ServerDetailProps) {
  if (!instance) {
    return (
      <aside className="server-detail empty">
        <p className="detail-hint">Select a rack on the floor to inspect its hardware.</p>
      </aside>
    );
  }

  const gpu = catalog?.gpus.find((g) => g.name === instance.gpu_name) ?? null;
  const model = catalog?.models.find((m) => m.name === instance.model_name) ?? null;

  return (
    <aside className="server-detail">
      <div className="detail-head">
        <h3>{instance.instance_id}</h3>
        <span className="detail-sub">
          {instance.model_name} · {instance.quant} on {instance.gpu_name}
        </span>
      </div>

      <div className="detail-section">
        <Row label={<InfoTooltip term="gpu_util">utilization</InfoTooltip>} value={pct(instance.gpu_util)} />
        <Row label={<InfoTooltip term="kv_pressure">KV pressure</InfoTooltip>} value={pct(instance.kv_pressure)} />
        <Row label={<InfoTooltip term="running">running</InfoTooltip>} value={String(instance.running)} />
        <Row label={<InfoTooltip term="queued">queued</InfoTooltip>} value={String(instance.queued)} />
        <Row label={<InfoTooltip term="power">power</InfoTooltip>} value={`${Math.round(instance.power_w)} W`} />
      </div>

      <div className="detail-section">
        <span className="detail-h">GPUs allocated</span>
        <div className="stepper-row">
          <button
            className="btn step-btn"
            disabled={finished || instance.gpu_count <= 0}
            onClick={() => controls.setGpuCount(instance.instance_id, Math.max(0, instance.gpu_count - 1))}
          >
            &minus;
          </button>
          <span className="stepper-count">{instance.gpu_count}</span>
          <button
            className="btn step-btn"
            disabled={finished || totalFree <= 0}
            onClick={() => controls.setGpuCount(instance.instance_id, instance.gpu_count + 1)}
          >
            +
          </button>
          <span className="stepper-free">{totalFree} free in pool</span>
        </div>
      </div>

      {gpu && (
        <div className="detail-section">
          <span className="detail-h">{gpu.name}</span>
          <Row label="HBM" value={`${gpu.hbm_gb.toFixed(0)} GB`} />
          <Row label={<InfoTooltip term="bandwidth">bandwidth</InfoTooltip>} value={`${gpu.hbm_bw_gbs.toFixed(0)} GB/s`} />
          <Row label="compute" value={tflops(gpu.peak_flops)} />
          <Row label="power" value={`${gpu.power_w.toFixed(0)} W`} />
          <Row label="rent" value={`$${gpu.cost_per_hour.toFixed(2)}/hr`} />
          <Row label="link" value={gpu.interconnect} />
        </div>
      )}

      {model && (
        <div className="detail-section">
          <span className="detail-h">{model.name}</span>
          <Row label="params" value={paramStr(model.num_params)} />
          <Row label="layers" value={String(model.num_layers)} />
          <Row label="KV heads" value={String(model.num_kv_heads)} />
        </div>
      )}
    </aside>
  );
}

interface RowProps {
  label: ReactNode;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
