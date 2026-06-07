import { useEffect, useState } from "react";

import { InfoTooltip } from "../InfoTooltip";
import type { Catalog, InstanceView } from "../../types";
import { fmt } from "../../format";
import { Segmented, Stepper } from "./primitives";
import type { EventFeed } from "./hooks";

const QUANTS = [
  { value: "fp16", label: "FP16" },
  { value: "int8", label: "INT8" },
  { value: "int4", label: "INT4" },
];
const TPS = [
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
];

const quantLabel = (q: string): string => q.toUpperCase();
const paramStr = (n: number): string => (n >= 1e9 ? (n / 1e9).toFixed(0) + "B" : (n / 1e6).toFixed(0) + "M");

interface ImpactItem {
  k: string;
  text: string;
  good: boolean;
}

interface ServingConfigProps {
  instance: InstanceView | null;
  catalog: Catalog | null;
  totalFree: number;
  finished: boolean;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  onSetGpu: (instanceId: string, count: number) => void;
  feed: EventFeed;
  t: number;
}

/**
 * The serving-config panel. The M1 sim fixes quantization / parallelism / KV strategy, so those
 * are shown as honest read-only reflections of the instance's real config; GPUs allocated is the
 * one live lever (set_gpu_count) and carries a first-order impact preview (rent and power per GPU
 * are known exactly from the catalog).
 */
export function ServingConfig({
  instance,
  catalog,
  totalFree,
  finished,
  advanced,
  setAdvanced,
  onSetGpu,
  feed,
  t,
}: ServingConfigProps) {
  const [preview, setPreview] = useState<{ id: number; items: ImpactItem[] } | null>(null);

  useEffect(() => {
    if (!preview) return;
    const h = window.setTimeout(() => setPreview(null), 4200);
    return () => clearTimeout(h);
  }, [preview]);

  if (!instance) {
    return (
      <section className="panel config">
        <header className="config-head">
          <div>
            <div className="config-title ds-title">serve-0</div>
            <div className="config-sub ds-code">waiting for the cluster…</div>
          </div>
        </header>
        <p className="knob-hint">Connect the simulation server to configure a serving instance.</p>
      </section>
    );
  }

  const gpu = catalog?.gpus.find((g) => g.name === instance.gpu_name) ?? null;
  const model = catalog?.models.find((m) => m.name === instance.model_name) ?? null;
  const replicas = Math.max(1, Math.floor(instance.gpu_count / Math.max(instance.tp, 1)));
  const maxGpus = instance.gpu_count + totalFree;

  const changeGpu = (next: number): void => {
    const count = Math.max(0, Math.min(maxGpus, next));
    const delta = count - instance.gpu_count;
    if (delta === 0) return;
    onSetGpu(instance.instance_id, count);
    if (gpu) {
      const up = delta > 0;
      const arrow = up ? "▲" : "▼";
      setPreview({
        id: Date.now(),
        items: [
          { k: "capacity", text: `${arrow} headroom`, good: up },
          { k: "$/hr", text: `${arrow} ${fmt.money2(Math.abs(delta) * gpu.cost_per_hour)}`, good: !up },
          { k: "power", text: `${arrow} ${fmt.kw(Math.abs(delta) * gpu.power_w)} kW`, good: !up },
        ],
      });
    }
    feed.pushToast(
      "good",
      "✦",
      `Scaled ${instance.instance_id}`,
      `${count} GPUs allocated — watch the triangle settle`,
    );
    feed.pushEvent("good", "scale", fmt.clock(t), `${instance.instance_id} → ${count} GPUs (${replicas}× replica)`);
  };

  return (
    <section className="panel config">
      <header className="config-head">
        <div>
          <div className="config-title ds-title">{instance.instance_id}</div>
          <div className="config-sub ds-code">
            {instance.model_name} · {quantLabel(instance.quant)} on {instance.gpu_name}
          </div>
        </div>
        <Segmented
          options={[
            { value: false, label: "Simple" },
            { value: true, label: "Advanced" },
          ]}
          value={advanced}
          onChange={setAdvanced}
        />
      </header>

      <div className="config-body">
        {/* SIMPLE — the one live lever */}
        <div className="knob-row">
          <div className="knob-head">
            <span className="knob-label">
              <InfoTooltip term="gpu_util" color="var(--c-blue)">
                GPUs allocated
              </InfoTooltip>
            </span>
            <span className="knob-readout ds-num">
              {replicas} replica{replicas > 1 ? "s" : ""} · {totalFree} free
            </span>
          </div>
          <Stepper
            value={instance.gpu_count}
            min={0}
            max={maxGpus}
            onChange={changeGpu}
            disabled={finished}
            suffix=" GPU"
          />
          <div className="knob-hint">
            Scale up the ramp to hold the SLO; scale back after so idle GPUs don't burn rent.
          </div>
          {preview && (
            <div className="impact" key={preview.id}>
              <span className="impact-tag">live impact</span>
              <div className="impact-items">
                {preview.items.map((it) => (
                  <span key={it.k} className="impact-item">
                    <span className="impact-k">{it.k}</span>
                    <span className={"delta " + (it.good ? "is-good" : "is-bad")}>{it.text}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* live load readout */}
        <div className="spec-sheet">
          <div className="advanced-rule">
            <span>live load</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">
              <InfoTooltip term="running">running</InfoTooltip> · <InfoTooltip term="queued">queued</InfoTooltip>
            </span>
            <span className="spec-val">
              {instance.running} · {instance.queued}
            </span>
          </div>
          <div className="spec-row">
            <span className="spec-label">
              <InfoTooltip term="kv_pressure">KV pressure</InfoTooltip>
            </span>
            <span className="spec-val">{fmt.pct(instance.kv_pressure, 0)}</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">
              <InfoTooltip term="power">power</InfoTooltip>
            </span>
            <span className="spec-val">{fmt.int(instance.power_w)} W</span>
          </div>
        </div>

        {/* ADVANCED — current serving config + hardware spec sheet */}
        <div className={"advanced" + (advanced ? " open" : "")}>
          <div className="advanced-inner">
            <div className="advanced-rule">
              <span>serving config</span>
            </div>

            <div className="knob-row">
              <div className="knob-head">
                <span className="knob-label">
                  <InfoTooltip term="quant">Quantization</InfoTooltip>
                </span>
                <span className="knob-readout">fixed in this scenario</span>
              </div>
              <Segmented options={QUANTS} value={instance.quant} accent="var(--c-cyan)" readonly />
            </div>

            <div className="knob-row">
              <div className="knob-head">
                <span className="knob-label">
                  <InfoTooltip term="tp" color="var(--c-violet)">
                    Tensor parallelism
                  </InfoTooltip>
                </span>
                <span className="knob-readout">fixed in this scenario</span>
              </div>
              <Segmented options={TPS} value={instance.tp} accent="var(--c-violet)" readonly />
            </div>

            <div className="toggle-row">
              <span className="knob-label">
                <InfoTooltip term="kv">KV cache</InfoTooltip>
              </span>
              <span className="knob-static ds-code">paged · on</span>
            </div>

            {(gpu || model) && (
              <>
                <div className="advanced-rule">
                  <span>hardware</span>
                </div>
                <div className="spec-sheet">
                  {gpu && (
                    <>
                      <SpecRow label={gpu.name} value={`${gpu.hbm_gb.toFixed(0)} GB HBM`} />
                      <SpecRow
                        label={<InfoTooltip term="bandwidth">bandwidth</InfoTooltip>}
                        value={`${gpu.hbm_bw_gbs.toFixed(0)} GB/s`}
                      />
                      <SpecRow label="compute" value={`${(gpu.peak_flops / 1e12).toFixed(0)} TFLOP/s`} />
                      <SpecRow label="rent" value={`$${gpu.cost_per_hour.toFixed(2)}/hr`} />
                    </>
                  )}
                  {model && (
                    <>
                      <SpecRow label={`${model.name} params`} value={paramStr(model.num_params)} />
                      <SpecRow label="layers · KV heads" value={`${model.num_layers} · ${model.num_kv_heads}`} />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SpecRow({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="spec-row">
      <span className="spec-label">{label}</span>
      <span className="spec-val">{value}</span>
    </div>
  );
}
