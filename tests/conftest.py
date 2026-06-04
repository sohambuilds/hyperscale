"""Shared test fixtures: one GPU class, one model, a workload, and a ready ClusterState
(the M1 minimal world)."""

import pytest

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


@pytest.fixture
def gpu() -> GpuType:
    return GpuType(
        name="A",
        hbm_gb=80.0,
        hbm_bw_gbs=3350.0,
        peak_flops=1.0e15,
        power_w=700.0,
        cost_per_hour=2.5,
        interconnect="nvlink",
    )


@pytest.fixture
def model() -> ModelSpec:
    return ModelSpec(
        name="M",
        num_params=8.0e9,
        num_layers=32,
        num_kv_heads=8,
        head_dim=128,
        dtype_bytes=2.0,
        kv_bytes=2.0,
    )


@pytest.fixture
def workload() -> WorkloadConfig:
    return WorkloadConfig(
        base_rate=20.0,  # 20 requests/sec baseline
        input_dist=LengthDist(median=512.0, sigma=0.5, min_len=8, max_len=8192),
        output_dist=LengthDist(median=128.0, sigma=0.5, min_len=1, max_len=2048),
        rate_points=((0.0, 1.0),),
    )


@pytest.fixture
def state(gpu: GpuType, model: ModelSpec, workload: WorkloadConfig) -> ClusterState:
    inst = ServingInstance(id="i0", model=model, gpu=gpu, gpu_count=4)
    return ClusterState(
        t=0.0,
        rng=Rng.from_seed(42),
        instances=[inst],
        free_gpus={"A": 8},
        cash=1_000_000.0,
        power_budget_w=2.0e6,
        pue=1.2,
        slo=SloConfig(),
        workload=workload,
        price_per_token=2.0e-6,  # $2 per 1M tokens
        price_per_wh=1.2e-4,  # $0.12/kWh
    )
