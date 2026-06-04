// Wire types — the TypeScript mirror of sim_core.types + the server's envelopes (server/ws.py).
// Keep in sync with the Python contract; this is the whole client/server agreement.

export interface Metrics {
  t: number;
  ttft_p50: number;
  ttft_p95: number;
  ttft_p99: number;
  tpot_p50: number;
  tpot_p95: number;
  tpot_p99: number;
  throughput_tok_s: number;
  goodput_tok_s: number;
  gpu_util: number;
  kv_pressure: number;
  power_w: number;
  power_budget_w: number;
  cost_per_hour: number;
  revenue_per_hour: number;
  slo_attainment: number;
  queue_depth: number;
  requests_completed: number;
  requests_churned: number;
}

export interface InstanceView {
  instance_id: string;
  model_name: string;
  gpu_name: string;
  gpu_count: number;
  tp: number;
  pp: number;
  quant: string;
  running: number;
  queued: number;
  kv_pressure: number;
  gpu_util: number;
  power_w: number;
}

// Static spec sheets (sim_core.types.GpuTypeView / ModelView / Catalog), sent once at init.
export interface GpuTypeView {
  name: string;
  hbm_gb: number;
  hbm_bw_gbs: number;
  peak_flops: number;
  power_w: number;
  cost_per_hour: number;
  interconnect: string;
}

export interface ModelView {
  name: string;
  num_params: number;
  num_layers: number;
  num_kv_heads: number;
  head_dim: number;
  dtype_bytes: number;
  kv_bytes: number;
}

export interface Catalog {
  gpus: GpuTypeView[];
  models: ModelView[];
}

export interface Observation {
  metrics: Metrics;
  cash: number;
  free_gpus: Record<string, number>;
  instances: InstanceView[];
}

export interface Score {
  profit: number;
  mean_slo_attainment: number;
  reliability: number;
  requests_completed: number;
  requests_churned: number;
  tokens_served: number;
}

export interface InitMsg {
  type: "init";
  scenario: string;
  seed: number;
  tick_seconds: number;
  duration_s: number;
  speed: number;
  paused: boolean;
  observation: Observation;
  catalog: Catalog;
}

export interface TickMsg {
  type: "tick";
  observation: Observation;
}

export interface DoneMsg {
  type: "done";
  observation: Observation;
  score: Score;
}

export interface ErrorMsg {
  type: "error";
  error: string;
}

export type ServerMsg = InitMsg | TickMsg | DoneMsg | ErrorMsg;

// Outbound control messages (server/schemas.py).
export type ControlMsg =
  | { type: "set_gpu_count"; instance_id: string; count: number }
  | { type: "step" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "set_speed"; speed: number };
