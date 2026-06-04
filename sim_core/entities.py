"""Core simulation entities (design doc §3.1).

Plain dataclasses, so the whole ``ClusterState`` serializes trivially (snapshot/restore,
replays, RL resets). Frozen where the data is immutable config; mutable where the simulation
advances it. M1 simplification: an instance runs on a single homogeneous GPU type
(``gpu`` + ``gpu_count``) rather than an arbitrary list of GPUs.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from sim_core.rng import Rng


@dataclass(frozen=True, slots=True)
class GpuType:
    """A class of GPU you can rent or buy."""

    name: str
    hbm_gb: float  # memory capacity (GB)
    hbm_bw_gbs: float  # memory bandwidth (GB/s) — the decode bottleneck
    peak_flops: float  # math throughput (FLOP/s, for the serving dtype) — prefill bottleneck
    power_w: float  # draw under load (W)
    cost_per_hour: float  # rent price or amortized capex ($/hr)
    interconnect: str  # "nvlink" | "pcie" — gates efficient tensor parallelism


@dataclass(frozen=True, slots=True)
class ModelSpec:
    """A model you serve. GQA-aware via ``num_kv_heads``."""

    name: str
    num_params: float  # total parameters
    num_layers: int
    num_kv_heads: int
    head_dim: int
    dtype_bytes: float  # weight bytes/param (FP16=2, FP8=1, INT4=0.5)
    kv_bytes: float  # KV bytes per element after any KV-quant


@dataclass(slots=True)
class Request:
    """One inference request, tracked through prefill and decode."""

    id: int
    arrive_t: float
    input_len: int
    target_output_len: int
    admit_t: float | None = None  # entered the running batch
    first_token_t: float | None = None
    done_t: float | None = None
    prefilled: int = 0  # input tokens prefilled so far
    generated: int = 0  # output tokens generated so far

    @property
    def prefill_done(self) -> bool:
        return self.prefilled >= self.input_len

    @property
    def live_tokens(self) -> int:
        """Tokens currently occupying KV cache for this request."""
        return min(self.prefilled, self.input_len) + self.generated


@dataclass(slots=True)
class ServingInstance:
    """One model deployed on a set of GPUs with a serving configuration."""

    id: str
    model: ModelSpec
    gpu: GpuType
    gpu_count: int
    tp: int = 1
    pp: int = 1
    quant: str = "fp16"
    paged_efficiency: float = 0.9  # fraction of free HBM usable for KV (PagedAttention-style)
    queue: deque[Request] = field(default_factory=deque)
    running: list[Request] = field(default_factory=list)
    last_util: float = 0.0  # display readout: compute utilization on the last tick (0..1).
    # Not read by step()'s physics — a surfaced value for dashboards. Carried in state so a
    # snapshot restores the last-shown reading; recomputed every tick regardless.


@dataclass(frozen=True, slots=True)
class SloConfig:
    """Latency targets a request must meet to count toward goodput / SLO attainment."""

    ttft_target_s: float = 1.0  # first token within 1 s
    tpot_target_s: float = 0.05  # <= 50 ms per output token (>= 20 tok/s)
    max_queue_wait_s: float = 30.0  # a request waiting longer than this abandons (churns)


@dataclass(frozen=True, slots=True)
class LengthDist:
    """A clamped lognormal distribution over a request's input or output length (tokens)."""

    median: float  # median length in tokens (the lognormal's exp(mean_log))
    sigma: float  # log-space standard deviation (spread)
    min_len: int
    max_len: int


@dataclass(frozen=True, slots=True)
class WorkloadConfig:
    """Serializable description of incoming traffic. Sampling logic lives in ``workload.py``.

    ``rate_points`` is a piecewise-linear schedule of (time_seconds, rate_multiplier) control
    points applied to ``base_rate`` — kept as data (not a function) so state stays serializable.
    """

    base_rate: float  # mean arrivals per second at multiplier 1.0
    input_dist: LengthDist
    output_dist: LengthDist
    rate_points: tuple[tuple[float, float], ...] = ((0.0, 1.0),)


@dataclass(slots=True)
class ClusterState:
    """The complete, serializable state of one simulation."""

    t: float
    rng: Rng
    instances: list[ServingInstance]
    free_gpus: dict[str, int]
    cash: float
    power_budget_w: float
    pue: float
    slo: SloConfig
    workload: WorkloadConfig
    price_per_token: float = 0.0  # business mode ($/token); 0 disables revenue in M1
    price_per_wh: float = 0.0  # electricity price ($/Wh)
    next_request_id: int = 0
    recent_completed: deque[Request] = field(default_factory=lambda: deque(maxlen=512))
