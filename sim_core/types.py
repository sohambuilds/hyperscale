"""The ``step()`` contract: the data that crosses the ``sim_core`` boundary.

These types are the durable artifact of the project. ``Action`` is what a player or agent
sends in; ``Metrics`` and ``Observation`` are what they get back each tick. This module is
kept free of internal imports so it stays a stable, dependency-light contract.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# --- Actions: what the player/agent can do each tick -------------------------------------
# M1 ships exactly one verb. As later milestones add verbs (pricing, per-model configuration,
# procurement, routing), widen ``Action`` into a tagged union:
#     Action = SetGpuCount | SetPrice | ConfigureInstance | BuyGpu | SetRoutingPolicy | ...


@dataclass(frozen=True, slots=True)
class SetGpuCount:
    """Set the number of GPUs allocated to a serving instance."""

    instance_id: str
    count: int


Action = SetGpuCount


# --- Metrics: the per-tick scalar dashboard ----------------------------------------------
@dataclass(frozen=True, slots=True)
class Metrics:
    """Scalar readouts collected at the end of a tick. Distribution-aware on latency."""

    t: float  # simulated time (seconds) at end of tick

    # latency percentiles over recently completed requests (seconds)
    ttft_p50: float
    ttft_p95: float
    ttft_p99: float
    tpot_p50: float
    tpot_p95: float
    tpot_p99: float

    # throughput (tokens/sec). goodput counts only tokens from SLO-meeting requests.
    throughput_tok_s: float
    goodput_tok_s: float

    # resource pressure (0..1)
    gpu_util: float
    kv_pressure: float

    # power (watts)
    power_w: float
    power_budget_w: float

    # money ($/hour)
    cost_per_hour: float
    revenue_per_hour: float

    # service quality
    slo_attainment: float  # fraction of recent completions meeting the SLO
    queue_depth: int

    # flow counters for this tick
    requests_completed: int
    requests_churned: int


# --- Observation: the per-tick view handed to a player/agent ------------------------------
@dataclass(frozen=True, slots=True)
class InstanceView:
    """A compact summary of one serving instance, for dashboards and agent observations.

    Carries enough hardware identity (gpu_name, tp/pp/quant) and live load (gpu_util, power_w)
    for a UI to draw the instance as physical hardware, not just a row of numbers.
    """

    instance_id: str
    model_name: str
    gpu_name: str
    gpu_count: int
    tp: int
    pp: int
    quant: str
    running: int  # sequences currently in the decode batch
    queued: int
    kv_pressure: float  # 0..1, KV-cache occupancy (caps the batch)
    gpu_util: float  # 0..1, compute utilization over the last tick
    power_w: float  # this instance's draw over the last tick (W)


@dataclass(frozen=True, slots=True)
class Observation:
    """What a player or RL agent sees each tick (a rollup of full state)."""

    metrics: Metrics
    cash: float
    free_gpus: dict[str, int]  # gpu-type name -> count available to allocate
    instances: list[InstanceView] = field(default_factory=list)


# --- Catalog: static spec sheets, sent once at init (not per tick) ------------------------
@dataclass(frozen=True, slots=True)
class GpuTypeView:
    """Static spec sheet for a GPU type — mirrors ``entities.GpuType`` for hardware panels."""

    name: str
    hbm_gb: float
    hbm_bw_gbs: float
    peak_flops: float
    power_w: float
    cost_per_hour: float
    interconnect: str


@dataclass(frozen=True, slots=True)
class ModelView:
    """Static spec sheet for a model — mirrors ``entities.ModelSpec`` for hardware panels."""

    name: str
    num_params: float
    num_layers: int
    num_kv_heads: int
    head_dim: int
    dtype_bytes: float
    kv_bytes: float


@dataclass(frozen=True, slots=True)
class Catalog:
    """Spec sheets for the GPU types and models present in a scenario.

    Static for the session, so the server sends it once in the init frame; the UI renders
    hardware detail panels from it without bloating every per-tick observation.
    """

    gpus: list[GpuTypeView] = field(default_factory=list)
    models: list[ModelView] = field(default_factory=list)
