# Fidelity ledger

A simulation is a model, and models are wrong in useful ways. This file lists every
deliberate simplification so we stay honest about what the engine approximates. Each entry
is both a **future-fidelity item** and a **calibration target** (milestone M4). The rule:
ship the simplest model that's honest, document it here, then climb the ladder deliberately.

## Current simplifications (M1)

| # | Simplification | Why it's OK for now | Climb to |
|---|----------------|---------------------|----------|
| 1 | **Analytic roofline model** for latency/throughput (closed-form, no kernel sim). | Produces the right *qualitative* tradeoffs cheaply and deterministically. | Calibrate constants to measured vLLM/TRT-LLM benchmarks within a stated error band. |
| 2 | **Constant MFU** (model FLOP utilization) for prefill. | First-order correct; MFU varies slowly with batch/shape. | Make MFU a function of batch size and sequence length. |
| 3 | **Decode is strictly memory-bandwidth-bound.** | True for the regimes we care about (weights + KV dominate reads). | Add a compute term for small batches / large heads. |
| 4 | **One token per decode step** (tick granularity). | Keeps the loop legible; 1 s tick covers many tokens in aggregate. | Sub-step the tick for finer inter-token latency. |
| 5 | **KV capacity via a single `paged_efficiency` factor**; no explicit fragmentation. | Captures the PagedAttention win as one tunable multiplier. | Model block/page allocation and fragmentation. |
| 6 | **Prefill cost ≈ 2·N FLOPs/token** (forward pass). | Standard first-order estimate for a dense transformer. | Account for attention's quadratic term at long context. |
| 7 | **Homogeneous single GPU type per instance** (`gpu` + `gpu_count`). | M1 needs one model on one GPU class. | Allow heterogeneous GPU sets per instance. |
| 8 | **TP/PP modeled as multipliers/penalties** (stubs in M1). | The interconnect/bubble *direction* is what matters first. | Calibrate comm overhead and pipeline-bubble curves. |
| 9 | **Network and storage abstracted away.** | Not the binding constraint for single-cluster serving. | Add cross-region/network and KV-offload tiers. |
| 10 | **Tick = 1 simulated second.** | Good interactive resolution; cheap. | Configurable / adaptive tick. |

## How to use this file

When you add a knob that removes one of these approximations, move it from "current" to a
"resolved" section with the calibration evidence. Reviewers (and future-you) read this as the
list of known assumptions — it is the project's honesty surface and its future-work list.
