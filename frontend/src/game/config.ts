// Tunable constants. Content is grounded in real LLM-serving tech (vLLM/SGLang/TRT-LLM) and real
// GPU/datacenter equipment, but balanced for fun. Numbers are indicative; the real sim_core
// calibration lands later (docs/BUILDER.md, docs/FIDELITY.md).

import type { GpuTierId, PlaceableKind, TechId } from "./types";

// --- grid -----------------------------------------------------------------------------------
export const GRID_COLS = 14;
export const GRID_ROWS = 10;

// --- starting conditions / win + lose ------------------------------------------------------
export const START_CASH = 20_000;
export const TICK_MS = 1000;
export const GOAL_CASH = 100_000;
export const BANKRUPT_FLOOR = -2_000;
export const BANKRUPT_GRACE = 20;

// --- placeable tiers (power & cooling are upgradeable in place) ------------------------------
export interface PowerTier {
  name: string;
  kw: number;
  capex: number;
  rentPerMin: number;
  minRep: number;
}
export const POWER_TIERS: PowerTier[] = [
  { name: "Rack PDU", kw: 6, capex: 4_000, rentPerMin: 4, minRep: 0 },
  { name: "Substation + UPS", kw: 24, capex: 12_000, rentPerMin: 9, minRep: 3 },
];

export interface CoolingTier {
  name: string;
  kw: number;
  pue: number; // facility PUE this cooling implies (lower = cheaper electricity)
  capex: number;
  rentPerMin: number;
  minRep: number;
}
export const COOLING_TIERS: CoolingTier[] = [
  { name: "CRAC air", kw: 6, pue: 1.45, capex: 3_500, rentPerMin: 4, minRep: 0 },
  { name: "Direct-to-chip liquid", kw: 18, pue: 1.15, capex: 11_000, rentPerMin: 9, minRep: 2 },
];

export const DEFAULT_PUE = 1.45; // when no cooling is built yet

export interface PlaceableSpec {
  label: string;
  short: string;
  capex: number;
  blurb: string;
}
// --- network uplink: caps total served req/s (base + gear). Upgradeable like power/cooling. ---
export const BASE_NET_CAP = 120; // the building's own uplink before you add switches (req/s)
export interface NetworkTier {
  name: string;
  cap: number; // req/s of bandwidth this tier provides
  capex: number;
  rentPerMin: number;
  minRep: number;
}
export const NETWORK_TIERS: NetworkTier[] = [
  { name: "Leaf switch", cap: 260, capex: 2_500, rentPerMin: 3, minRep: 0 },
  { name: "Spine fabric", cap: 820, capex: 8_000, rentPerMin: 7, minRep: 4 },
];

// --- crew pod: houses a construction crew (+1 builder when operational) ----------------------
export const CREWPOD = { name: "Crew pod", capex: 3_500, rentPerMin: 5 };
export const BASE_BUILDERS = 2; // builders you start with (no pod needed)
export const MAX_BUILDERS = 8;

// --- construction: placing a building takes a free builder + wall-clock time -----------------
export const BUILD_MS: Record<PlaceableKind, number> = {
  power: 3_000,
  cooling: 3_000,
  rack: 2_200,
  network: 3_200,
  crewpod: 3_600,
};

// Base (tier-0) specs used by the build palette.
export const PLACEABLES: Record<PlaceableKind, PlaceableSpec> = {
  power: { label: "Power", short: "PWR", capex: POWER_TIERS[0].capex, blurb: "Power capacity (kW). Upgrade to a Substation for far more. GPUs need power to run." },
  cooling: { label: "Cooling", short: "COOL", capex: COOLING_TIERS[0].capex, blurb: "Removes heat. Upgrade to Liquid for more capacity and a lower PUE (cheaper power)." },
  rack: { label: "Rack", short: "RACK", capex: 1_500, blurb: "Holds up to 4 GPU servers. Pick its GPU tier and serving policy in the inspector." },
  network: { label: "Network", short: "NET", capex: NETWORK_TIERS[0].capex, blurb: "Uplink bandwidth — caps total req/s served. Upgrade to a Spine fabric to serve far more." },
  crewpod: { label: "Crew pod", short: "CREW", capex: CREWPOD.capex, blurb: "Houses a build crew: +1 builder, so you can construct more at once." },
};
export const RACK_CAPEX = 1_500;
export const RACK_RENT_PER_MIN = 1;
export const SELL_REFUND = 0.5;

// --- GPU server tiers (anti-linear: newer = more perf AND more capex+watts; older wins on
//     perf-per-watt / perf-per-dollar for loose, low-margin contracts) -----------------------
export interface GpuTier {
  id: GpuTierId;
  name: string;
  hbm: number;
  capex: number;
  rentPerMin: number;
  drawKw: number;
  thruRps: number;
  latRps: number;
  minRep: number;
}
export const GPU_TIERS: Record<GpuTierId, GpuTier> = {
  a100: { id: "a100", name: "A100", hbm: 80, capex: 700, rentPerMin: 18, drawKw: 0.4, thruRps: 22, latRps: 13, minRep: 0 },
  h100: { id: "h100", name: "H100", hbm: 80, capex: 1_000, rentPerMin: 34, drawKw: 0.7, thruRps: 40, latRps: 24, minRep: 0 },
  h200: { id: "h200", name: "H200", hbm: 141, capex: 1_600, rentPerMin: 50, drawKw: 0.7, thruRps: 56, latRps: 34, minRep: 3 },
  b200: { id: "b200", name: "B200", hbm: 192, capex: 2_800, rentPerMin: 90, drawKw: 1.3, thruRps: 100, latRps: 60, minRep: 6 },
};
export const GPU_TIER_ORDER: GpuTierId[] = ["a100", "h100", "h200", "b200"];
export const DEFAULT_GPU_TIER: GpuTierId = "h100";
export const RACK_SLOTS = 4;

// --- economy --------------------------------------------------------------------------------
export const ELEC_PER_KWH = 0.1;

// --- contract archetypes (realistic inference customers) ------------------------------------
export interface Archetype {
  name: string;
  kind: "baseline" | "burst";
  strict: boolean;
  quality: boolean;
  baseDemand: number;
  price: number;
  penalty: number;
  minReputation: number;
  note: string;
}

export const ARCHETYPES: Archetype[] = [
  { name: "Chatbot backfill", kind: "baseline", strict: false, quality: false, baseDemand: 75, price: 0.026, penalty: 0, minReputation: 0, note: "Free-tier chat overflow. Huge steady volume, loose SLA, cheapest — throughput-pool filler." },
  { name: "Realtime assistant", kind: "baseline", strict: true, quality: true, baseDemand: 42, price: 0.06, penalty: 0.09, minReputation: 0, note: "Live in-product copilot. Tight p99, premium FP16, modest demand — needs latency headroom." },
  { name: "Code completion", kind: "baseline", strict: true, quality: false, baseDemand: 70, price: 0.04, penalty: 0.05, minReputation: 1, note: "IDE fill-in-the-middle. Brutally latency-sensitive but short + quantization-tolerant." },
  { name: "Embeddings pipeline", kind: "baseline", strict: false, quality: false, baseDemand: 200, price: 0.01, penalty: 0, minReputation: 1, note: "Bulk vectorization. Enormous req/s, single forward pass, rock-bottom price — fills idle cycles." },
  { name: "Batch summarization", kind: "baseline", strict: false, quality: false, baseDemand: 140, price: 0.013, penalty: 0, minReputation: 2, note: "Overnight summarization. Deep queues welcome, dirt cheap, quantization-happy. Lowest margin." },
  { name: "RAG / long-context", kind: "baseline", strict: false, quality: false, baseDemand: 55, price: 0.05, penalty: 0, minReputation: 2, note: "Retrieval Q&A with huge prompts. Prefill-heavy, eats HBM, loves prefix caching." },
  { name: "Launch-day burst", kind: "burst", strict: false, quality: false, baseDemand: 90, price: 0.05, penalty: 0, minReputation: 2, note: "Product launch flood. Idle then a sustained 2-3x surge. Take it only with headroom." },
  { name: "Voice / streaming", kind: "baseline", strict: true, quality: true, baseDemand: 45, price: 0.07, penalty: 0.1, minReputation: 3, note: "Realtime TTS — audio must stream faster than spoken. Hardest steady tail latency." },
  { name: "Document OCR", kind: "baseline", strict: false, quality: false, baseDemand: 120, price: 0.015, penalty: 0, minReputation: 3, note: "Scanned-page extraction at scale, async. Batchable multimodal prefill, cheap." },
  { name: "Vision-language", kind: "baseline", strict: false, quality: true, baseDemand: 38, price: 0.07, penalty: 0, minReputation: 4, note: "Image+text Q&A. Heavy vision-encoder prefill; premium clients reject quant artifacts." },
  { name: "Agentic tool-use", kind: "baseline", strict: true, quality: true, baseDemand: 38, price: 0.08, penalty: 0.12, minReputation: 4, note: "Multi-step agent loops — per-step latency compounds. Lucrative but capacity-greedy." },
  { name: "Viral event", kind: "burst", strict: false, quality: false, baseDemand: 110, price: 0.04, penalty: 0, minReputation: 4, note: "Social-virality spike — sharpest, least-warned burst. Over-provision or breach gamble." },
  { name: "Premium API", kind: "baseline", strict: true, quality: true, baseDemand: 55, price: 0.1, penalty: 0.15, minReputation: 5, note: "Flagship paid API with contractual p99 + FP16. Highest steady price, stiff breach penalty." },
  { name: "Breaking news", kind: "burst", strict: true, quality: false, baseDemand: 75, price: 0.06, penalty: 0.08, minReputation: 5, note: "Newsroom live summarization — flat then a strict surge while a story is hot." },
  { name: "Reasoning model", kind: "baseline", strict: false, quality: true, baseDemand: 28, price: 0.12, penalty: 0, minReputation: 6, note: "Long chain-of-thought, thousands of decode tokens. Top price, loose TTFT, huge capacity drain." },
  { name: "Trading desk", kind: "burst", strict: true, quality: true, baseDemand: 50, price: 0.12, penalty: 0.18, minReputation: 7, note: "Market-hours signals — violent strict bursts on volatility. Top price AND tight SLA AND brutal penalty." },
];

export const MAX_OFFERS = 4;
export const OFFER_INTERVAL = 16;
export const CHURN_AFTER = 22;
export const REP_PER_TICK_ON_TRACK = 0.004;

// --- research tech tree: 4 PARALLEL branches, multiple roots (real techniques) ---------------
export type TechBranch = "throughput" | "memory" | "latency" | "efficiency";

export interface TechEffect {
  thruMult?: number;
  latMult?: number;
  capMult?: number;
  powerMult?: number;
  qualityRevMult?: number;
}

export interface TechSpec {
  id: TechId;
  name: string;
  branch: TechBranch;
  cost: number;
  effect: string;
  tradeoff: string;
  requires: TechId[];
  fx: TechEffect;
}

export const BRANCHES: { key: TechBranch; name: string }[] = [
  { key: "throughput", name: "Throughput" },
  { key: "memory", name: "Memory & Capacity" },
  { key: "latency", name: "Latency" },
  { key: "efficiency", name: "Efficiency" },
];

export const TECHS: TechSpec[] = [
  // Throughput
  { id: "continuous_batching", name: "Continuous batching", branch: "throughput", cost: 3_000, requires: [], fx: { thruMult: 1.25 }, effect: "Admit new requests the moment any finishes — the throughput pool stays packed. +25% throughput.", tradeoff: "Fuller batches lengthen the tail unless you keep some latency-tuned capacity." },
  { id: "chunked_prefill", name: "Chunked prefill", branch: "throughput", cost: 6_000, requires: ["continuous_batching"], fx: { thruMult: 1.15, latMult: 1.05 }, effect: "Interleave long prefills with decode so one big prompt can't stall the batch. +15% throughput.", tradeoff: "Per-chunk attention re-reads add overhead if the chunk size is off." },
  { id: "tensor_parallelism", name: "Tensor parallelism", branch: "throughput", cost: 9_000, requires: ["chunked_prefill"], fx: { capMult: 1.15 }, effect: "Split each layer across GPUs in a rack so big models run and aggregate compute rises. +15% capacity.", tradeoff: "Per-layer all-reduce only pays off with fast in-rack NVLink." },
  // Memory & capacity
  { id: "paged_attention", name: "PagedAttention", branch: "memory", cost: 4_000, requires: [], fx: { capMult: 1.2 }, effect: "Page the KV cache to kill fragmentation — far more concurrent sequences per GPU. +20% capacity.", tradeoff: "Needs a custom attention kernel + block manager." },
  { id: "prefix_caching", name: "Prefix caching (RadixAttention)", branch: "memory", cost: 6_000, requires: ["paged_attention"], fx: { latMult: 1.2 }, effect: "Reuse shared prompt prefixes — skip prefill, drop TTFT. +20% latency capacity.", tradeoff: "Only helps shared-prefix workloads; the cache competes for HBM." },
  { id: "kv_cache_quant", name: "KV-cache quantization", branch: "memory", cost: 6_000, requires: ["paged_attention"], fx: { capMult: 1.2 }, effect: "Store the KV cache in FP8 — roughly half the memory, longer context / more concurrency. +20% capacity.", tradeoff: "Quality erodes with very long context; INT8 KV costs a couple points." },
  { id: "weight_quant_fp8", name: "Weight quantization (FP8)", branch: "memory", cost: 8_000, requires: ["kv_cache_quant"], fx: { thruMult: 1.3, powerMult: 0.85, qualityRevMult: 0.92 }, effect: "8-bit weights — less bandwidth pressure, faster decode, −15% power. +30% throughput.", tradeoff: "Premium FP16-only clients pay ~8% less for quantized output." },
  { id: "weight_quant_int4", name: "Weight quantization (INT4/AWQ)", branch: "memory", cost: 11_000, requires: ["weight_quant_fp8"], fx: { thruMult: 1.5, powerMult: 0.75, qualityRevMult: 0.8 }, effect: "4-bit weights — biggest capacity gain on cheap cards, −25% power. +50% throughput.", tradeoff: "Visible quality drop: premium clients pay ~20% less." },
  // Latency
  { id: "cuda_graphs", name: "CUDA graph capture", branch: "latency", cost: 3_500, requires: [], fx: { latMult: 1.2 }, effect: "Replay a decode step as one captured graph — no per-token kernel-launch overhead. +20% latency capacity.", tradeoff: "Static shapes force batch-size bucketing with padding + eager fallback." },
  { id: "speculative_decoding", name: "Speculative decoding (EAGLE)", branch: "latency", cost: 8_000, requires: ["cuda_graphs"], fx: { latMult: 1.3, powerMult: 1.06 }, effect: "A draft head proposes tokens the model verifies in one pass — 2-3x faster decode. +30% latency capacity.", tradeoff: "Wasted compute when drafts are rejected; +6% power for the draft." },
  { id: "mtp_heads", name: "Multi-token prediction (EAGLE-3)", branch: "latency", cost: 12_000, requires: ["speculative_decoding"], fx: { latMult: 1.25 }, effect: "Trained heads draft several tokens from the model's own state — higher acceptance, lower TPOT. +25% latency capacity.", tradeoff: "Heads need training/upkeep; gains shrink once batches saturate compute." },
  // Efficiency
  { id: "power_capping", name: "Power capping / DVFS", branch: "efficiency", cost: 4_000, requires: [], fx: { powerMult: 0.82, thruMult: 0.95, latMult: 0.95 }, effect: "Cap GPU clocks so perf-per-watt rises — fit more cards under the same power & cooling. −18% power.", tradeoff: "Trades ~5% raw speed for headroom; only nets out when power/cooling-bound." },
  { id: "disaggregation", name: "Disaggregated prefill/decode", branch: "efficiency", cost: 15_000, requires: [], fx: { capMult: 1.25 }, effect: "Separate prefill and decode pools so each runs ideal hardware and batch policy. +25% capacity.", tradeoff: "Complex orchestration; needs scale + a fast fabric to ship the KV cache." },
];
