// Mission Control derivations: turn the live wire Metrics into the three triangle strains,
// the gauge zones, and the traffic snapshot. The design prototype shipped a toy compute model;
// here the real simulation server is the source of truth, so we only *read* its metrics and
// shape them for display. Constants mirror the sim's own contract (sim_core SloConfig +
// scenarios/ramp.py) so the readouts mean exactly what the engine measured.

import type { Metrics } from "./types";

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Latency promise a request must meet — mirrors sim_core.entities.SloConfig defaults.
export const TTFT_TARGET_S = 1.0; // first token within 1 s
export const TPOT_TARGET_S = 0.05; // <= 50 ms per output token

// One strain per triangle corner, 0..~1.25 (1.0 == at the limit, >1 == breaching).
export interface Strains {
  latency: number; // cyan  — how close p99 latency is to the SLO
  cost: number; // amber — power draw against the budget
  traffic: number; // magenta — offered load against capacity
}

/** Saturating contribution of a growing queue: a backlog tips traffic past "at capacity". */
function queuePressure(queueDepth: number): number {
  const q = Math.max(0, queueDepth);
  return (q / (q + 60)) * 0.45;
}

/** Derive the three corner strains from one live metrics frame. */
export function deriveStrains(m: Metrics): Strains {
  const latency = clamp(
    Math.max(m.ttft_p99 / TTFT_TARGET_S, m.tpot_p99 / TPOT_TARGET_S),
    0,
    1.4,
  );
  const cost = clamp(m.power_budget_w > 0 ? m.power_w / m.power_budget_w : 0, 0, 1.4);
  const traffic = clamp(m.gpu_util + queuePressure(m.queue_depth), 0, 1.4);
  return { latency, cost, traffic };
}

export const NEUTRAL_STRAINS: Strains = { latency: 0.35, cost: 0.35, traffic: 0.4 };

// --- gauge zones (fraction of max → color) --------------------------------------------------
export interface Zone {
  upTo: number;
  color: string;
  rgb: string;
}

export const SLO_ZONES: Zone[] = [
  { upTo: 0.9, color: "var(--c-red)", rgb: "248,113,113" },
  { upTo: 0.98, color: "var(--c-amber)", rgb: "251,191,36" },
  { upTo: 1.01, color: "var(--c-green)", rgb: "74,222,128" },
];
export const UTIL_ZONES: Zone[] = [
  { upTo: 0.75, color: "var(--c-green)", rgb: "74,222,128" },
  { upTo: 0.92, color: "var(--c-amber)", rgb: "251,191,36" },
  { upTo: 1.5, color: "var(--c-red)", rgb: "248,113,113" },
];
export const KV_ZONES: Zone[] = [
  { upTo: 0.7, color: "var(--c-violet)", rgb: "192,132,252" },
  { upTo: 0.9, color: "var(--c-amber)", rgb: "251,191,36" },
  { upTo: 1.3, color: "var(--c-red)", rgb: "248,113,113" },
];
export const PWR_ZONES: Zone[] = [
  { upTo: 0.75, color: "var(--c-green)", rgb: "74,222,128" },
  { upTo: 0.92, color: "var(--c-amber)", rgb: "251,191,36" },
  { upTo: 1.3, color: "var(--c-red)", rgb: "248,113,113" },
];

// --- traffic snapshot -----------------------------------------------------------------------
export type TrafficState = "healthy" | "near" | "over";

export interface TrafficSnapshot {
  reqs: number; // estimated arrivals (req/s) this tick
  capacity: number; // estimated sustainable rate (req/s)
  load: number; // reqs / capacity
  state: TrafficState;
  series: number[]; // recent arrivals window, for the waveform
}

/**
 * Per-tick arrivals from conservation: arrivals = completed + churned + Δqueue. The wire counts
 * are per-tick (the server sums them for the final score), and tick == 1 s, so this is req/s.
 */
export function deriveArrivals(history: Metrics[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const dQueue = i > 0 ? m.queue_depth - history[i - 1].queue_depth : 0;
    out.push(Math.max(0, m.requests_completed + m.requests_churned + dQueue));
  }
  return out;
}

/** Estimate the sustainable serving rate by extrapolating the served rate to full utilization. */
function capacityEstimate(m: Metrics): number {
  const served = m.requests_completed; // per-tick == req/s
  const util = clamp(m.gpu_util, 0.15, 1);
  return Math.max(served / util, served, 1);
}

export function trafficSnapshot(m: Metrics, history: Metrics[], window = 48): TrafficSnapshot {
  const arrivals = deriveArrivals(history);
  const series = arrivals.slice(-window);
  const reqs = series.length ? series[series.length - 1] : 0;
  const capacity = capacityEstimate(m);
  const load = capacity > 0 ? reqs / capacity : 0;
  const state: TrafficState =
    m.queue_depth > 5 || load > 1.02 ? "over" : m.gpu_util > 0.85 || load > 0.85 ? "near" : "healthy";
  return { reqs, capacity, load, state, series };
}

/** Last `n` values of a metric selector, for sparklines. */
export function recent(history: Metrics[], sel: (m: Metrics) => number, n = 48): number[] {
  return history.slice(-n).map(sel);
}
