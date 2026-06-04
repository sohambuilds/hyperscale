"""Physics unit tests — every roofline function checked against a hand-computed value, plus
the qualitative monotonicities that make the game's tradeoffs real."""

from dataclasses import replace

import pytest

from sim_core.entities import GpuType, ModelSpec
from sim_core.physics import (
    GB,
    decode_step_time,
    kv_bytes_per_token,
    max_concurrent_tokens,
    per_gpu_weight_bytes,
    pp_bubble_penalty,
    prefill_time,
    tp_comm_overhead,
    weight_bytes,
)

# --- exact closed-form values ------------------------------------------------------------


def test_weight_bytes(model: ModelSpec) -> None:
    # 8e9 params * 2 bytes/param = 16 GB
    assert weight_bytes(model) == pytest.approx(1.6e10)


def test_per_gpu_weight_shards_by_tp(model: ModelSpec) -> None:
    assert per_gpu_weight_bytes(model, tp=1) == pytest.approx(1.6e10)
    assert per_gpu_weight_bytes(model, tp=2) == pytest.approx(8.0e9)


def test_kv_bytes_per_token(model: ModelSpec) -> None:
    # 2 * 32 layers * 8 kv_heads * 128 head_dim * 2 bytes = 131072 bytes/token
    assert kv_bytes_per_token(model) == pytest.approx(131072.0)


def test_max_concurrent_tokens(model: ModelSpec, gpu: GpuType) -> None:
    # free = 80e9 - 16e9 = 64e9; usable = 64e9 * 0.9 = 57.6e9; / 131072 = 439453.125 -> floor
    assert max_concurrent_tokens(model, gpu, gpu_count=1) == 439453


def test_decode_step_time_weight_only() -> None:
    # 16 GB read at 3350 GB/s = 16e9 / 3.35e12 s
    assert decode_step_time(1.6e10, 0.0, 3350.0) == pytest.approx(1.6e10 / 3.35e12)


def test_decode_step_time_adds_kv() -> None:
    active_kv = 131072.0 * 100_000  # 100k tokens of KV
    expected = (1.6e10 + active_kv) / (3350.0 * GB)
    assert decode_step_time(1.6e10, active_kv, 3350.0) == pytest.approx(expected)


def test_prefill_time() -> None:
    # 2 * 8e9 * 512 = 8.192e12 FLOPs; eff = 1e15 * 0.4 = 4e14 FLOP/s -> 0.02048 s
    assert prefill_time(512, 8.0e9, 1.0e15, mfu=0.4) == pytest.approx(0.02048)


def test_tp_comm_overhead() -> None:
    assert tp_comm_overhead(1, "nvlink") == 0.0
    assert tp_comm_overhead(2, "nvlink") == pytest.approx(50.0e-6)
    assert tp_comm_overhead(2, "pcie") == pytest.approx(500.0e-6)
    # PCIe punishes tensor parallelism much harder than NVLink
    assert tp_comm_overhead(4, "pcie") > tp_comm_overhead(4, "nvlink")


def test_pp_bubble_penalty() -> None:
    assert pp_bubble_penalty(1, 8) == 0.0
    assert pp_bubble_penalty(2, 8) == pytest.approx(1.0 / 9.0)


# --- qualitative tradeoffs (the physics that makes decisions matter) ----------------------


def test_more_gpus_hold_more_tokens(model: ModelSpec, gpu: GpuType) -> None:
    one = max_concurrent_tokens(model, gpu, gpu_count=1)
    four = max_concurrent_tokens(model, gpu, gpu_count=4)
    assert four == pytest.approx(one * 4, rel=1e-9)


def test_quantization_frees_kv_and_speeds_decode(model: ModelSpec, gpu: GpuType) -> None:
    int4 = replace(model, dtype_bytes=0.5)
    # smaller weights -> more room for KV
    assert max_concurrent_tokens(int4, gpu, 1) > max_concurrent_tokens(model, gpu, 1)
    # smaller weights -> fewer bytes read per decode step -> faster
    fp16_step = decode_step_time(per_gpu_weight_bytes(model), 0.0, gpu.hbm_bw_gbs)
    int4_step = decode_step_time(per_gpu_weight_bytes(int4), 0.0, gpu.hbm_bw_gbs)
    assert int4_step < fp16_step


def test_bigger_batch_slows_each_step(model: ModelSpec, gpu: GpuType) -> None:
    w = per_gpu_weight_bytes(model)
    small = decode_step_time(w, kv_bytes_per_token(model) * 1_000, gpu.hbm_bw_gbs)
    large = decode_step_time(w, kv_bytes_per_token(model) * 200_000, gpu.hbm_bw_gbs)
    assert large > small
