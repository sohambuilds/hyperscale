// Construction-tycoon game model. A self-contained, front-end "fake but honest" economy that
// carries the core tension: capacity planning under bursty, uncertain demand — now with a
// contract portfolio, stakes, a session goal, and the real serving tech tree. (sim_core
// integration comes later — see docs/BUILDER.md.)

export type Tool = "cursor" | "power" | "cooling" | "rack" | "network" | "crewpod" | "sell";

/** Things that occupy a grid tile. GPU servers install into a rack's slots. */
export type PlaceableKind = "power" | "cooling" | "rack" | "network" | "crewpod";

/** Per-rack serving policy — the central batch-size ↔ latency dial. */
export type Policy = "latency" | "throughput";

/** GPU server tiers installable in a rack (anti-linear: newer = more perf AND more capex+watts). */
export type GpuTierId = "a100" | "h100" | "h200" | "b200";

export interface Placed {
  id: string;
  kind: PlaceableKind;
  col: number;
  row: number;
  tier?: number; // power/cooling/network upgrade level (0 = base, 1 = upgraded)
  buildMs?: number; // ms of construction remaining; >0 = under construction (not operational)
  // rack-only:
  gpus?: number; // installed GPU servers (0..RACK_SLOTS)
  policy?: Policy;
  gpuType?: GpuTierId; // which GPU tier this rack's servers are
  bornAt?: number; // tick placed — drives the power-on animation
}

export type ContractKind = "baseline" | "burst";
export type ContractStatus = "on-track" | "at-risk" | "breaching";

/** A demand source you accept. Mixing steady + bursty, strict + loose IS the game. */
export interface Contract {
  id: string;
  name: string;
  kind: ContractKind;
  strict: boolean; // strict latency ⇒ must be served by latency-tuned capacity
  quality: boolean; // premium client — pays less if you serve quantized output
  baseDemand: number; // req/s baseline
  price: number; // $ per request served
  penalty: number; // $ per strict request breached
  // runtime:
  demand: number;
  served: number;
  health: number; // 0..1 rolling served-fraction (EMA)
  status: ContractStatus;
  burstT: number;
  breachT: number;
}

export interface Offer {
  id: string;
  name: string;
  kind: ContractKind;
  strict: boolean;
  quality: boolean;
  baseDemand: number;
  price: number;
  penalty: number;
}

// --- research tech tree (the moat: real techniques, real tradeoffs) -------------------------
export type TechId =
  | "continuous_batching"
  | "chunked_prefill"
  | "tensor_parallelism"
  | "paged_attention"
  | "prefix_caching"
  | "kv_cache_quant"
  | "weight_quant_fp8"
  | "weight_quant_int4"
  | "cuda_graphs"
  | "speculative_decoding"
  | "mtp_heads"
  | "power_capping"
  | "disaggregation";

export type GameStatus = "playing" | "won" | "lost";

/** Ephemeral floating feedback (e.g. "+$12" over a serving rack). */
export interface FxItem {
  id: number;
  rackId: string;
  text: string;
  kind: "cash" | "breach";
}

export interface Stats {
  powerCap: number;
  powerUsed: number;
  coolCap: number;
  coolUsed: number;
  pue: number;
  latencyCap: number;
  throughputCap: number;
  netCap: number; // req/s the uplink can carry (base + network gear)
  gpus: number;
  gpusOnline: number;
  demand: number;
  served: number;
  breached: number;
  revPerSec: number;
  rentPerSec: number;
  elecPerSec: number;
  penaltyPerSec: number;
  profitPerSec: number;
}

export interface GameState {
  cash: number;
  tick: number;
  paused: boolean;
  speed: number;
  placed: Placed[];
  contracts: Contract[];
  offers: Offer[];
  selectedId: string | null;
  tool: Tool;
  reputation: number;
  unlocked: TechId[];
  status: GameStatus;
  bankruptT: number; // ticks spent below the overdraft floor (drives game-over)
  muted: boolean;
  // run stats (for the end-of-run report / score):
  totalEarned: number;
  servedTotal: number;
  peakReputation: number;
  peakCash: number;
  // quests (chain of detected goals; the one click is claiming):
  questDone: string[]; // completed (latched by tick detection)
  questClaimed: string[]; // rewards collected
  questProg: Record<string, number>; // counters for transient conditions (peaks, hold streaks)
  // ui / flavor:
  message: string | null;
  nextOfferAt: number;
  fx: FxItem[];
  fxSeq: number;
}
