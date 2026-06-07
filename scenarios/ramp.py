"""The M1 scenario: a 10-minute traffic ramp on one model + one GPU type.

Traffic starts comfortable and climbs to ~6x over 600 simulated seconds — past the point where
the starting 4-GPU instance can keep up, so an idle player watches TTFT rise, the queue back
up, and requests churn. The intended play is to scale GPUs up the ramp and back down after,
trading rent against SLO attainment. Scoring is intentionally light here (the full results
screen is Phase B); this module exists so the headless runner and the determinism tests have a
concrete, fixed world to drive.
"""

from __future__ import annotations

from dataclasses import dataclass

from sim_core.entities import (
    ClusterState,
    GpuType,
    LengthDist,
    ModelSpec,
    ServingInstance,
    SloConfig,
    WorkloadConfig,
)
from sim_core.rng import Rng
from sim_core.types import Metrics

DURATION_S: int = 600  # 10 simulated minutes
PEAK_MULTIPLIER: float = 6.0  # traffic at the end of the ramp, relative to the start

_GPU = GpuType(
    name="H100",
    hbm_gb=80.0,
    hbm_bw_gbs=3350.0,
    peak_flops=1.0e15,
    power_w=700.0,
    cost_per_hour=2.5,
    interconnect="nvlink",
)

_MODEL = ModelSpec(
    name="llama-8b",
    num_params=8.0e9,
    num_layers=32,
    num_kv_heads=8,
    head_dim=128,
    dtype_bytes=2.0,
    kv_bytes=2.0,
)


def build_state(
    seed: int,
    *,
    base_rate: float = 50.0,
    peak: float = PEAK_MULTIPLIER,
    duration: float = float(DURATION_S),
    gpu_count: int = 4,
    free_gpus: int = 12,
    cash: float = 50_000.0,
    power_budget_w: float = 12_000.0,
    pue: float = 1.2,
    input_median: float = 512.0,
    output_median: float = 128.0,
    slo: SloConfig | None = None,
) -> ClusterState:
    """Build a starting ``ClusterState`` for a ramp-style level.

    The campaign reuses this with different knobs (gentler demand, tighter power budget, …)
    to vary difficulty without duplicating the H100 / llama-8b catalog. Defaults reproduce the
    original M1 ramp exactly, so the golden-trajectory test stays valid.
    """
    workload = WorkloadConfig(
        base_rate=base_rate,
        input_dist=LengthDist(median=input_median, sigma=0.5, min_len=8, max_len=8192),
        output_dist=LengthDist(median=output_median, sigma=0.5, min_len=1, max_len=2048),
        rate_points=((0.0, 1.0), (float(duration), peak)),
    )
    inst = ServingInstance(id="serve-0", model=_MODEL, gpu=_GPU, gpu_count=gpu_count)
    return ClusterState(
        t=0.0,
        rng=Rng.from_seed(seed),
        instances=[inst],
        free_gpus={_GPU.name: free_gpus},
        cash=cash,
        power_budget_w=power_budget_w,
        pue=pue,
        slo=slo if slo is not None else SloConfig(),
        workload=workload,
        price_per_token=5.0e-7,  # $0.50 per 1M served tokens
        price_per_wh=1.2e-4,  # $0.12/kWh
    )


def make_state(seed: int) -> ClusterState:
    """Build the starting ``ClusterState`` for the M1 ramp (50 → ~300 req/s over 10 min)."""
    return build_state(seed)


@dataclass(frozen=True, slots=True)
class Score:
    """A compact end-of-run summary. The weighted composite is a placeholder for the full
    Phase-B scoring (profit + SLO uptime + efficiency)."""

    profit: float
    mean_slo_attainment: float
    reliability: float  # completed / (completed + churned)
    requests_completed: int
    requests_churned: int
    tokens_served: float


def score(history: list[Metrics], profit: float, dt: float = 1.0) -> Score:
    """Summarize a finished run from its per-tick metrics and realized cash delta."""
    n = max(len(history), 1)
    completed = sum(m.requests_completed for m in history)
    churned = sum(m.requests_churned for m in history)
    handled = completed + churned
    tokens = sum(m.goodput_tok_s * dt for m in history)
    return Score(
        profit=profit,
        mean_slo_attainment=sum(m.slo_attainment for m in history) / n,
        reliability=(completed / handled) if handled else 1.0,
        requests_completed=completed,
        requests_churned=churned,
        tokens_served=tokens,
    )
