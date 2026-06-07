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
  quant: {
    term: "Quantization",
    short: "Storing weights in fewer bits (FP16→INT4): more throughput and less memory, for a small quality hit.",
  },
  batch: {
    term: "Batch size",
    short: "How many requests share one GPU forward pass — bigger batches lift throughput but raise the latency tail.",
  },
  tp: {
    term: "Tensor parallelism",
    short: "Splitting one model across several GPUs so they compute each layer together — needs fast NVLink.",
  },
  kv: {
    term: "KV cache",
    short: "Reusing each request's attention state instead of recomputing it — the single biggest serving speedup.",
  },
  spec: {
    term: "Speculative decoding",
    short: "A small draft model guesses several tokens that the big model verifies in one pass — faster streaming.",
  },
  quality: {
    term: "Quality",
    short: "Relative answer quality vs full FP16 precision — quantization trades a few points for speed.",
  },
  triangle: {
    term: "The hard triangle",
    short: "Latency SLOs, cost & power, and incoming traffic pull against each other — push one corner and the other two strain.",
  },
};
