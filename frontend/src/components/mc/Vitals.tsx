import { InfoTooltip } from "../InfoTooltip";
import type { Metrics } from "../../types";
import { fmt } from "../../format";
import {
  KV_ZONES,
  PWR_ZONES,
  SLO_ZONES,
  UTIL_ZONES,
  recent,
  trafficSnapshot,
} from "../../mission";
import { Gauge, Sparkline, Waveform } from "./viz";

interface VitalCardProps {
  label: string;
  term?: string;
  value: string;
  unit?: string;
  color?: string;
  spark?: number[];
  sparkRgb?: string;
}

/** One vital: label, big mono value, unit, and a sparkline of its recent trace. */
function VitalCard({ label, term, value, unit, color = "var(--fg)", spark, sparkRgb }: VitalCardProps) {
  return (
    <div className="vital">
      <div className="vital-head">
        <span className="vital-label ds-label">{term ? <InfoTooltip term={term}>{label}</InfoTooltip> : label}</span>
      </div>
      <div className="vital-body">
        <span className="vital-val ds-num" style={{ color }}>
          {value}
        </span>
        {unit ? <span className="vital-unit">{unit}</span> : null}
      </div>
      {spark && spark.length > 1 && <Sparkline data={spark} color={color} rgb={sparkRgb} />}
    </div>
  );
}

const TRAFFIC_STATE_LABEL = { healthy: "healthy", near: "near capacity", over: "over capacity" } as const;

interface VitalsGridProps {
  m: Metrics;
  history: Metrics[];
}

export function VitalsGrid({ m, history }: VitalsGridProps) {
  const traffic = trafficSnapshot(m, history);

  const ttftTone = m.ttft_p99 > 1.0 ? "var(--c-red)" : m.ttft_p99 > 0.6 ? "var(--c-amber)" : "var(--c-green)";
  const tpotTone = m.tpot_p99 > 0.05 ? "var(--c-red)" : m.tpot_p99 > 0.035 ? "var(--c-amber)" : "var(--c-green)";
  const trafficTone =
    traffic.state === "over" ? "is-bad" : traffic.state === "near" ? "is-warn" : "is-good";

  return (
    <div className="vitals">
      {/* gauges */}
      <div className="gauge-row">
        <Gauge value={m.slo_attainment} max={1} label="SLO met" term="slo" zones={SLO_ZONES} format={(v) => fmt.pct(v)} />
        <Gauge value={m.gpu_util} max={1} label="GPU util" term="gpu_util" zones={UTIL_ZONES} format={(v) => Math.round(v * 100) + "%"} />
        <Gauge value={m.kv_pressure} max={1} label="KV pressure" term="kv_pressure" zones={KV_ZONES} format={(v) => Math.round(v * 100) + "%"} />
        <Gauge
          value={m.power_w}
          max={m.power_budget_w}
          label="power"
          term="power"
          unit="kW"
          zones={PWR_ZONES}
          format={(v) => fmt.kw(v)}
        />
      </div>

      {/* traffic waveform — incoming demand vs capacity */}
      <div className="vital traffic-card">
        <div className="vital-head">
          <span className="vital-label ds-label">
            <InfoTooltip term="throughput">incoming traffic</InfoTooltip>
          </span>
          <span className={"traffic-state " + trafficTone}>{TRAFFIC_STATE_LABEL[traffic.state]}</span>
        </div>
        <div className="traffic-row">
          <div className="traffic-num">
            <span className="vital-val ds-num">{fmt.int(traffic.reqs)}</span>
            <span className="vital-unit">req/s</span>
            <div className="traffic-cap ds-code">
              cap {fmt.int(traffic.capacity)} · {Math.round(traffic.load * 100)}% load
            </div>
          </div>
          <Waveform data={traffic.series} capacity={traffic.capacity} />
        </div>
      </div>

      {/* latency · throughput · economics */}
      <div className="vital-grid">
        <VitalCard
          label="TTFT p99"
          term="ttft"
          value={fmt.ms(m.ttft_p99)}
          color={ttftTone}
          spark={recent(history, (x) => x.ttft_p99)}
          sparkRgb={m.ttft_p99 > 1.0 ? "248,113,113" : "34,211,238"}
        />
        <VitalCard
          label="TPOT p99"
          term="tpot"
          value={fmt.ms(m.tpot_p99)}
          color={tpotTone}
          spark={recent(history, (x) => x.tpot_p99)}
          sparkRgb={m.tpot_p99 > 0.05 ? "248,113,113" : "74,222,128"}
        />
        <VitalCard
          label="throughput"
          term="throughput"
          value={fmt.tok(m.throughput_tok_s)}
          unit="tok/s"
          color="var(--c-blue)"
          spark={recent(history, (x) => x.throughput_tok_s)}
          sparkRgb="96,165,250"
        />
        <VitalCard
          label="goodput"
          term="goodput"
          value={fmt.tok(m.goodput_tok_s)}
          unit="tok/s"
          color="var(--c-green)"
          spark={recent(history, (x) => x.goodput_tok_s)}
          sparkRgb="74,222,128"
        />
        <VitalCard
          label="burn"
          term="cost"
          value={fmt.money2(m.cost_per_hour)}
          unit="/hr"
          color="var(--c-amber)"
          spark={recent(history, (x) => x.cost_per_hour)}
          sparkRgb="251,191,36"
        />
        <VitalCard
          label="revenue"
          term="revenue"
          value={fmt.money(m.revenue_per_hour)}
          unit="/hr"
          color="var(--c-green)"
          spark={recent(history, (x) => x.revenue_per_hour)}
          sparkRgb="74,222,128"
        />
      </div>
    </div>
  );
}
