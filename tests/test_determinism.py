"""Determinism is load-bearing: identical (seed, actions) must yield an identical trajectory,
and that trajectory is pinned to a committed golden hash so an accidental change to the physics
or loop order can't slip through unnoticed.

The scripted world here is self-contained (not the ramp scenario) so tuning ``scenarios/ramp``
never disturbs the golden. Floats are quantized to 1e-6 before hashing so the hash is stable
across platforms (last-ULP differences in numpy transforms don't flip it) while still catching
any meaningful regression."""

import dataclasses
import hashlib
import json

from sim_core.engine import step
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
from sim_core.types import Metrics, SetGpuCount

# Committed golden hash of the scripted trajectory below. Regenerate intentionally (and review
# the diff) if the physics or per-tick loop changes on purpose.
GOLDEN_HASH = "29c97809c654ffd60af405d742de81c04791c1567f7a8a53658297a7e16d4048"

# Scripted actions applied at specific ticks: scale up into the ramp, then back down.
_SCRIPT: dict[int, list[SetGpuCount]] = {
    40: [SetGpuCount("i0", 6)],
    90: [SetGpuCount("i0", 2)],
}


def _build(seed: int) -> ClusterState:
    gpu = GpuType(
        name="A",
        hbm_gb=80.0,
        hbm_bw_gbs=3350.0,
        peak_flops=1.0e15,
        power_w=700.0,
        cost_per_hour=2.5,
        interconnect="nvlink",
    )
    model = ModelSpec(
        name="M",
        num_params=8.0e9,
        num_layers=32,
        num_kv_heads=8,
        head_dim=128,
        dtype_bytes=2.0,
        kv_bytes=2.0,
    )
    workload = WorkloadConfig(
        base_rate=80.0,
        input_dist=LengthDist(median=512.0, sigma=0.5, min_len=8, max_len=8192),
        output_dist=LengthDist(median=128.0, sigma=0.5, min_len=1, max_len=2048),
        rate_points=((0.0, 1.0), (120.0, 3.0)),
    )
    inst = ServingInstance(id="i0", model=model, gpu=gpu, gpu_count=3)
    return ClusterState(
        t=0.0,
        rng=Rng.from_seed(seed),
        instances=[inst],
        free_gpus={"A": 8},
        cash=100_000.0,
        power_budget_w=1.0e6,
        pue=1.2,
        slo=SloConfig(),
        workload=workload,
        price_per_token=1.0e-6,
        price_per_wh=1.2e-4,
    )


def _canon(m: Metrics) -> list[object]:
    """Quantize a Metrics row for platform-stable hashing (floats to 1e-6, ints exact)."""
    return [round(v, 6) if isinstance(v, float) else v for v in dataclasses.astuple(m)]


def _trajectory(seed: int, ticks: int = 120) -> list[list[object]]:
    state = _build(seed)
    rows: list[list[object]] = []
    for i in range(ticks):
        _, _, m = step(state, _SCRIPT.get(i, []))
        rows.append(_canon(m))
    return rows


def _hash(rows: list[list[object]]) -> str:
    return hashlib.sha256(json.dumps(rows).encode()).hexdigest()


def test_same_seed_and_actions_are_bit_identical() -> None:
    # Exact equality (not just the quantized hash): same inputs, same floats.
    a = _build(7)
    b = _build(7)
    for i in range(120):
        _, _, ma = step(a, _SCRIPT.get(i, []))
        _, _, mb = step(b, _SCRIPT.get(i, []))
        assert dataclasses.astuple(ma) == dataclasses.astuple(mb)


def test_golden_trajectory_hash() -> None:
    assert _hash(_trajectory(7)) == GOLDEN_HASH


def test_different_seed_diverges() -> None:
    assert _hash(_trajectory(7)) != _hash(_trajectory(8))
