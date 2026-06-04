"""Engine integration tests: the per-tick loop produces the contract types, money flows the
right direction, and the design's qualitative tradeoffs emerge (more GPUs cut latency under
load; sustained overload churns). Closed-form physics is unit-tested in ``test_physics.py``;
here we check the assembled simulation behaves."""

import dataclasses

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
from sim_core.types import Metrics, Observation, SetGpuCount


def _make_state(
    gpu: GpuType,
    model: ModelSpec,
    *,
    gpu_count: int,
    base_rate: float,
    seed: int = 7,
    free: int = 16,
    price_per_token: float = 2.0e-6,
) -> ClusterState:
    """A single-instance world with a steady (flat-rate) workload, parameterized for the
    behavior under test."""
    workload = WorkloadConfig(
        base_rate=base_rate,
        input_dist=LengthDist(median=512.0, sigma=0.5, min_len=8, max_len=8192),
        output_dist=LengthDist(median=128.0, sigma=0.5, min_len=1, max_len=2048),
        rate_points=((0.0, 1.0),),
    )
    inst = ServingInstance(id="i0", model=model, gpu=gpu, gpu_count=gpu_count)
    return ClusterState(
        t=0.0,
        rng=Rng.from_seed(seed),
        instances=[inst],
        free_gpus={"A": free},
        cash=1_000_000.0,
        power_budget_w=2.0e6,
        pue=1.2,
        slo=SloConfig(),
        workload=workload,
        price_per_token=price_per_token,
        price_per_wh=1.2e-4,
    )


def _run(state: ClusterState, n: int, actions: list[SetGpuCount] | None = None) -> list[Metrics]:
    out: list[Metrics] = []
    for _ in range(n):
        _, _, m = step(state, list(actions) if actions else [])
        out.append(m)
    return out


# --- contract & plumbing ------------------------------------------------------------------
def test_step_advances_time_and_returns_contract(state: ClusterState) -> None:
    s2, obs, m = step(state, [])
    assert s2 is state  # mutates in place and returns the same object
    assert state.t == 1.0
    assert m.t == 1.0
    assert isinstance(obs, Observation)
    assert obs.cash == state.cash
    assert len(obs.instances) == 1
    assert obs.instances[0].instance_id == "i0"


def test_requests_flow_through_to_completion(state: ClusterState) -> None:
    metrics = _run(state, 30)
    assert state.next_request_id > 0  # arrivals were generated
    assert any(m.requests_completed > 0 for m in metrics)
    assert any(m.throughput_tok_s > 0 for m in metrics)


# --- economics ----------------------------------------------------------------------------
def test_idle_gpus_drain_cash(gpu: GpuType, model: ModelSpec) -> None:
    s = _make_state(gpu, model, gpu_count=4, base_rate=0.0)
    start = s.cash
    metrics = _run(s, 5)
    assert s.cash < start  # rent + idle power burn even with zero traffic
    assert all(m.cost_per_hour > 0 for m in metrics)
    assert all(m.revenue_per_hour == 0.0 for m in metrics)
    assert metrics[-1].gpu_util == 0.0


def test_good_tokens_generate_revenue(state: ClusterState) -> None:
    metrics = _run(state, 20)
    assert any(m.goodput_tok_s > 0 for m in metrics)
    assert any(m.revenue_per_hour > 0 for m in metrics)
    assert metrics[-1].slo_attainment > 0.9  # well-provisioned: nearly all completions meet SLO


# --- qualitative tradeoffs (the doc's physics must emerge) ---------------------------------
def test_more_gpus_reduce_latency_under_load(gpu: GpuType, model: ModelSpec) -> None:
    # Same arrival stream (same seed); only the GPU count differs.
    small = _run(_make_state(gpu, model, gpu_count=1, base_rate=200.0, seed=11), 30)
    large = _run(_make_state(gpu, model, gpu_count=8, base_rate=200.0, seed=11), 30)
    assert sum(m.requests_completed for m in large) > sum(m.requests_completed for m in small)
    assert large[-1].ttft_p99 < small[-1].ttft_p99  # big cluster keeps the TTFT tail down


def test_sustained_overload_causes_churn(gpu: GpuType, model: ModelSpec) -> None:
    # One GPU under ~12x its prefill capacity: the queue backs up past patience (30 s) and
    # waiting requests abandon.
    s = _make_state(gpu, model, gpu_count=1, base_rate=300.0, seed=5)
    metrics = _run(s, 45)
    assert sum(m.requests_churned for m in metrics) > 0


# --- determinism (full golden-trajectory test lives in test_determinism.py) ----------------
def test_engine_is_deterministic(gpu: GpuType, model: ModelSpec) -> None:
    actions = [SetGpuCount("i0", 6)]
    a = _run(_make_state(gpu, model, gpu_count=4, base_rate=50.0, seed=99), 25, actions)
    b = _run(_make_state(gpu, model, gpu_count=4, base_rate=50.0, seed=99), 25, actions)
    assert [dataclasses.astuple(m) for m in a] == [dataclasses.astuple(m) for m in b]


# --- SetGpuCount action -------------------------------------------------------------------
def test_set_gpu_count_allocates_from_free_pool(gpu: GpuType, model: ModelSpec) -> None:
    s = _make_state(gpu, model, gpu_count=2, base_rate=0.0, free=4)
    step(s, [SetGpuCount("i0", 5)])  # wants +3, 4 free → takes 3
    assert s.instances[0].gpu_count == 5
    assert s.free_gpus["A"] == 1


def test_set_gpu_count_capped_by_availability(gpu: GpuType, model: ModelSpec) -> None:
    s = _make_state(gpu, model, gpu_count=2, base_rate=0.0, free=1)
    step(s, [SetGpuCount("i0", 10)])  # wants +8, only 1 free
    assert s.instances[0].gpu_count == 3
    assert s.free_gpus["A"] == 0


def test_set_gpu_count_decrease_returns_gpus(gpu: GpuType, model: ModelSpec) -> None:
    s = _make_state(gpu, model, gpu_count=4, base_rate=0.0, free=2)
    step(s, [SetGpuCount("i0", 1)])  # delta -3 → release to the pool
    assert s.instances[0].gpu_count == 1
    assert s.free_gpus["A"] == 5
