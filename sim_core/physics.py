"""Roofline physics for LLM serving (design §3.3).

A closed-form, physically grounded approximation — cheap, deterministic, and it produces the
right qualitative tradeoffs: decode is memory-bandwidth-bound, prefill is compute-bound, and
the KV cache caps how many tokens you can hold concurrently. Constants get calibrated to real
benchmarks later (see ``docs/FIDELITY.md``).

Unit conventions (decimal SI):
  * memory sizes in bytes; ``hbm_gb * GB`` = bytes
  * bandwidth in GB/s; ``* GB`` = bytes/s
  * compute in FLOP/s; times in seconds
"""

from __future__ import annotations

from sim_core.entities import GpuType, ModelSpec

GB: float = 1.0e9


def weight_bytes(model: ModelSpec) -> float:
    """Total bytes of model weights at the model's serving dtype."""
    return model.num_params * model.dtype_bytes


def per_gpu_weight_bytes(model: ModelSpec, tp: int = 1) -> float:
    """Weight bytes resident on each GPU after tensor-parallel sharding."""
    return weight_bytes(model) / tp


def kv_bytes_per_token(model: ModelSpec) -> float:
    """KV-cache bytes for one token, summed across all layers (K and V)."""
    return 2.0 * model.num_layers * model.num_kv_heads * model.head_dim * model.kv_bytes


def max_concurrent_tokens(
    model: ModelSpec,
    gpu: GpuType,
    gpu_count: int,
    tp: int = 1,
    pp: int = 1,
    paged_efficiency: float = 0.9,
) -> int:
    """Max KV tokens an instance can hold concurrently — the batch ceiling.

    Per GPU, HBM not used by weights is available for KV (discounted by ``paged_efficiency``,
    which folds in activation + fragmentation overhead for M1). KV for a token is sharded
    across the ``tp`` GPUs of a replica; the instance runs ``gpu_count // (tp*pp)`` replicas.
    """
    hbm_bytes = gpu.hbm_gb * GB
    free_after_weight = hbm_bytes - per_gpu_weight_bytes(model, tp)
    if free_after_weight <= 0.0:
        return 0
    usable_kv_per_gpu = free_after_weight * paged_efficiency
    tokens_per_replica = usable_kv_per_gpu * tp / kv_bytes_per_token(model)
    replicas = gpu_count // (tp * pp)
    return int(tokens_per_replica * replicas)


def tp_comm_overhead(tp: int, interconnect: str) -> float:
    """Per-decode-step latency added by tensor-parallel all-reduces (seconds).

    Zero for ``tp == 1``. NVLink is cheap; PCIe is punishing — this is what encodes "don't
    span tensor parallelism across servers". Calibrated later; directionally correct now.
    """
    if tp <= 1:
        return 0.0
    per_link = 50.0e-6 if interconnect == "nvlink" else 500.0e-6
    return per_link * (tp - 1)


def pp_bubble_penalty(pp: int, microbatches: int) -> float:
    """Fraction of pipeline time lost to fill/drain bubbles. Zero for ``pp == 1``."""
    if pp <= 1:
        return 0.0
    return (pp - 1) / (microbatches + pp - 1)


def decode_step_time(
    per_gpu_weight_b: float,
    active_kv_bytes_per_gpu: float,
    hbm_bw_gbs: float,
    tp_comm_s: float = 0.0,
) -> float:
    """Time for one decode step = per-output-token latency (TPOT), in seconds.

    Decode is memory-bandwidth-bound: each step reads the resident weights plus the live KV
    for the active batch out of HBM. A bigger batch reads more KV per step (slower step) but
    emits more tokens per step — hence the throughput/latency sweet spot.
    """
    bytes_per_step = per_gpu_weight_b + active_kv_bytes_per_gpu
    return bytes_per_step / (hbm_bw_gbs * GB) + tp_comm_s


def prefill_time(
    prefill_tokens: int,
    num_params: float,
    peak_flops: float,
    mfu: float = 0.4,
    tp_scaling: float = 1.0,
) -> float:
    """Time to prefill ``prefill_tokens`` tokens, in seconds.

    Prefill is compute-bound: ~2·N FLOPs per token for a forward pass over N params, divided
    by the GPU's achievable FLOP/s (peak × MFU × any TP scaling).
    """
    flops = 2.0 * num_params * prefill_tokens
    eff_flops = peak_flops * mfu * tp_scaling
    return flops / eff_flops
