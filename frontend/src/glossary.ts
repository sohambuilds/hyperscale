// Single source of truth for plain-language definitions of the sim's vocabulary. The in-app
// InfoTooltip and HelpPanel read from here; docs/GLOSSARY.md (Stage 3) mirrors it. Keys are stable
// ids referenced across components — keep them in sync with the labels they annotate.

export interface GlossaryEntry {
  term: string; // display name
  short: string; // one-sentence, beginner-facing definition
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  ttft: {
    term: "TTFT",
    short: "Time To First Token — how long a user waits before the first word of the reply appears.",
  },
  tpot: {
    term: "TPOT",
    short: "Time Per Output Token — the gap between generated tokens; sets how fast the reply streams.",
  },
  throughput: {
    term: "Throughput",
    short: "Total tokens generated per second across every request the cluster is serving.",
  },
  goodput: {
    term: "Goodput",
    short: "Tokens per second from requests that met their latency target — the throughput that actually counts.",
  },
  slo: {
    term: "SLO",
    short: "Service-Level Objective — the latency promise (fast first token, steady streaming) a request must meet.",
  },
  kv_pressure: {
    term: "KV cache pressure",
    short: "How full the GPU memory holding each request's attention state is; at 100% no new request can be admitted.",
  },
  gpu_util: {
    term: "GPU utilization",
    short: "Fraction of the last second the GPUs spent doing useful work (prefill + decode).",
  },
  queue: {
    term: "Queue depth",
    short: "Requests waiting for a free slot across the cluster; a growing queue means you're under-provisioned.",
  },
  queued: {
    term: "Queued",
    short: "Requests parked in this instance's queue, waiting to be admitted into the batch.",
  },
  running: {
    term: "Running",
    short: "Requests currently being generated in this instance's GPU batch.",
  },
  power: {
    term: "Power",
    short: "Watts drawn by the cluster under load; multiplied by PUE for the real datacenter draw.",
  },
  pue: {
    term: "PUE",
    short: "Power Usage Effectiveness — datacenter overhead factor; 1.2 means 20% extra for cooling and power loss.",
  },
  churn: {
    term: "Churn",
    short: "Requests that gave up waiting in the queue and left — lost customers, and lost revenue.",
  },
  prefill: {
    term: "Prefill",
    short: "Reading the whole prompt in one compute-heavy pass to produce the first output token.",
  },
  decode: {
    term: "Decode",
    short: "Generating the reply one token at a time; limited by memory bandwidth, not raw math.",
  },
  bandwidth: {
    term: "Memory bandwidth",
    short: "How fast a GPU streams weights and KV cache from memory — the decode bottleneck.",
  },
  cash: {
    term: "Cash",
    short: "Your balance: revenue from served tokens minus GPU rent and electricity.",
  },
  revenue: {
    term: "Revenue",
    short: "Money earned from tokens that met the SLO (goodput × price per token).",
  },
  cost: {
    term: "Cost",
    short: "GPU rent plus electricity (power × PUE × price) — what the cluster burns each hour.",
  },
  scenario: {
    term: "Scenario",
    short: "A scripted traffic pattern — here a 10-minute ramp of rising demand — that you're scored on.",
  },
  time: {
    term: "Time",
    short: "Elapsed simulated seconds out of the scenario's total length.",
  },
};
