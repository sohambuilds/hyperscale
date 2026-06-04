import { useMemo } from "react";
import type uPlot from "uplot";

import type { Metrics } from "../types";
import { Chart, type ChartOptions } from "./Chart";
import { InfoTooltip } from "./InfoTooltip";

const AXIS = "#8b93a7";
const GRID = "rgba(255, 255, 255, 0.06)";

// Latency percentiles — green/amber/red, p95 drawn heaviest (the SLO line).
const C_P50 = "#4ade80";
const C_P95 = "#fbbf24";
const C_P99 = "#f87171";
const C_BLUE = "#60a5fa";
const C_GREEN = "#4ade80";
const C_PURPLE = "#c084fc";
const C_RED = "#f87171";

const axes: uPlot.Axis[] = [
  { stroke: AXIS, grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID, width: 1 } },
  { stroke: AXIS, grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID, width: 1 }, size: 56 },
];

function options(series: uPlot.Series[]): ChartOptions {
  return {
    scales: { x: { time: false } },
    axes,
    series: [{ label: "t" }, ...series],
  };
}

const ttftOpts = options([
  { label: "p50", stroke: C_P50, width: 1.5 },
  { label: "p95", stroke: C_P95, width: 2.25 },
  { label: "p99", stroke: C_P99, width: 1.5 },
]);

const tpotOpts = options([
  { label: "p50", stroke: C_P50, width: 1.5 },
  { label: "p95", stroke: C_P95, width: 2.25 },
  { label: "p99", stroke: C_P99, width: 1.5 },
]);

const tputOpts = options([
  { label: "throughput", stroke: C_BLUE, width: 1.75 },
  { label: "goodput", stroke: C_GREEN, width: 1.75 },
]);

const utilOpts = options([
  { label: "gpu", stroke: C_BLUE, width: 1.75 },
  { label: "kv", stroke: C_PURPLE, width: 1.75 },
]);

const moneyOpts = options([
  { label: "revenue", stroke: C_GREEN, width: 1.75 },
  { label: "cost", stroke: C_RED, width: 1.75 },
]);

interface DashboardProps {
  history: Metrics[];
}

export function Dashboard({ history }: DashboardProps) {
  const data = useMemo(() => {
    const xs = history.map((m) => m.t);
    const col = (f: (m: Metrics) => number): number[] => history.map(f);
    return {
      ttft: [xs, col((m) => m.ttft_p50 * 1000), col((m) => m.ttft_p95 * 1000), col((m) => m.ttft_p99 * 1000)] as uPlot.AlignedData,
      tpot: [xs, col((m) => m.tpot_p50 * 1000), col((m) => m.tpot_p95 * 1000), col((m) => m.tpot_p99 * 1000)] as uPlot.AlignedData,
      tput: [xs, col((m) => m.throughput_tok_s), col((m) => m.goodput_tok_s)] as uPlot.AlignedData,
      util: [xs, col((m) => m.gpu_util * 100), col((m) => m.kv_pressure * 100)] as uPlot.AlignedData,
      money: [xs, col((m) => m.revenue_per_hour), col((m) => m.cost_per_hour)] as uPlot.AlignedData,
    };
  }, [history]);

  return (
    <div className="dashboard">
      <ChartCard title="TTFT" term="ttft" subtitle="p50 / p95 / p99 — ms" options={ttftOpts} data={data.ttft} />
      <ChartCard title="TPOT" term="tpot" subtitle="p50 / p95 / p99 — ms/token" options={tpotOpts} data={data.tpot} />
      <ChartCard title="Throughput" term="throughput" subtitle="throughput vs goodput — tok/s" options={tputOpts} data={data.tput} />
      <ChartCard title="Utilization" term="gpu_util" subtitle="GPU vs KV pressure — %" options={utilOpts} data={data.util} />
      <ChartCard title="Economics" term="revenue" subtitle="revenue vs cost — $/hour" options={moneyOpts} data={data.money} />
    </div>
  );
}

interface ChartCardProps {
  title: string;
  term?: string;
  subtitle: string;
  options: ChartOptions;
  data: uPlot.AlignedData;
}

function ChartCard({ title, term, subtitle, options: opts, data }: ChartCardProps) {
  return (
    <div className="chart-card">
      <div className="chart-head">
        <span className="chart-title">
          {term ? <InfoTooltip term={term}>{title}</InfoTooltip> : title}
        </span>
        <span className="chart-sub">{subtitle}</span>
      </div>
      <Chart options={opts} data={data} />
    </div>
  );
}
