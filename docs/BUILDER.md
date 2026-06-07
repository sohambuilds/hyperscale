# INFERENCE — Datacenter Builder (Construction Tycoon)

> **The core tension (the fantasy), in one sentence:**
> **You race slow, expensive capacity against fast, bursty, uncertain demand — over-provision and idle GPUs bleed cash; under-provision and you breach SLAs, drop requests, and churn customers.**
>
> That's the job of running inference infra, and it's the game. Every meter, contract, upgrade,
> and GPU purchase exists to make that one bet — *how much capacity, of what kind, when* — sharper
> and harder. Without it, a tycoon collapses into "find the optimal build, then click to expand."
> With it, the build is never finished because demand never holds still.
>
> You build the datacenter **from scratch** on the isometric grid and serve real AI inference.
> **No triangle / observability dashboard** — feedback is simple and tangible. Supersedes the
> triangle framing in [`PROGRESSION.md`](PROGRESSION.md). `sim_core` runs **under the hood**.
> Status: design only.

---

## 1. Why this version wins (the moat)

Generic datacenter tycoons exist. **Nobody has built one where the tech tree is actually
correct.** The edge here is domain truth: the upgrades are the *real* serving techniques (the
stuff that's in vLLM), each with its *real* tradeoff — not abstract "+10% efficiency" buttons.
That authenticity is the pitch ("the only tycoon where the tech tree is real") and the systems-
depth signal to anyone who looks under the hood.

So two design rules sit above everything:
1. **Model the real tension** (capacity vs. volatile demand) — §3.
2. **Make every mechanic real** (contracts, the batch/latency dial, the tech tree, the economy
   all mirror how inference serving actually behaves) — §4–§8.

---

## 2. Core loop

```
   Empty plot ──build──► POWER ─► COOLING ─► RACKS ─► GPU SERVERS ─► NETWORK ──switch on──►
        ▲                                                                                  │
        │ reinvest / expand                                                                ▼
        │                                              CONTRACTS arrive (steady + bursty demand)
        │                                                                                  │
        │                                            serve within SLA ──► paid (per token) │
        │                                            breach / drop ──► penalty + churn ◄────┘
        └──────── buy gear · research real techniques · retune serving policy ─────────────┘
```

- **Build** (anytime, pausable): place / move / sell / upgrade.
- **Run** (continuous, pause·1×·2×·4×): contracts demand service; your capacity serves or breaches;
  cash ticks. The fun is the *retune* — demand shifts, so your "optimal" build keeps drifting.

---

## 3. The canvas & what you build

The isometric floor (`frontend/src/iso.ts`, `DatacenterFloor`) **is** the build surface — reuse
its projection, tile faces, and `heatColor` glow (now driven by real load/heat). Start on a small
plot; **buy floor / halls** as you grow.

| Category | Placeable | Gives you | Needs | Unlock |
|---|---|---|---|---|
| **Power** | Utility hookup → Substation/UPS | power capacity (kW), resilience | floor | start / tier |
| **Cooling** | CRAC (air) → Liquid/Immersion | heat removal; **lowers PUE** (§7) | power, floor | start / tier |
| **Rack** | Server rack | slots for GPU servers | floor | start |
| **Compute** | GPU server (A100 → H100 → H200 → B200) | serving capacity; runs a **serving policy** (§5) | rack slot + power + cooling + network | per tier (§6) |
| **Network** | Switch / uplink | request bandwidth; connects pools | power, floor | start / tier |
| **Space** | Expand hall / floor | more buildable area | $ + milestone | milestone |

**Dependency chain (the puzzle):** a GPU server only runs when it's *in a rack + powered + cooled
+ networked*. Power capacity ≥ draw, cooling ≥ heat, network ≥ throughput, slots ≥ servers.
Ghost-preview placement shows validity ("needs power", "no cooling", "no free slot") so rules
teach themselves. **But the chain is a one-time puzzle — the *ongoing* game is §4–§5.**

---

## 4. Demand = SLA contracts (this is what gives the game teeth)

Demand isn't a vague "happy %". It's a **portfolio of contracts** you accept. Each contract:

```
Contract
  model        : which model to serve (e.g. llama-8b, llama-70b)
  demand       : req/s — a curve, not a constant (baseline level + burstiness)
  sla          : p99 latency target (e.g. < 400 ms) the served requests must meet
  price        : per token, with input/output asymmetry (§7)
  quality_req  : e.g. "FP16 only" (forbids quantized serving) for premium contracts
  term         : duration; penalty on breach; reputation effect
```

**Two kinds, and mixing them IS the capacity-planning game:**

| Type | Demand | Margin | SLA | Role |
|---|---|---|---|---|
| **Baseline / reserved** | steady, predictable | low | moderate | size your owned capacity to these; your bread and butter |
| **Spot / burst** | volatile, spiky, on-demand | high | often strict | take them *only if you have headroom* — a burst while you're full = breach |

This makes the "customers" meter concrete and **economic**: served-within-SLA = paid; breach =
penalty + churn + reputation hit. Contracts are also the **mission structure** — accepting and
holding a tougher contract *is* a goal. The eternal question: *carry idle headroom for the
lucrative bursts, or run lean and risk a breach when one lands?* That's the fantasy, surfaced.

---

## 5. The serving dial: batch size ↔ latency (the recurring decision)

The central inference tension, made a knob you constantly retune. Each GPU pool runs a **serving
policy**:

| Policy | Batches | TTFT / tail | Throughput (req/s) | Best for |
|---|---|---|---|---|
| **Latency-optimized** | small | low, tight tail | lower | strict-SLA / premium contracts |
| **Throughput-optimized** | large | higher, worse tail | high | loose-SLA, high-volume / batch contracts |

One global setting can't satisfy a mixed contract portfolio → you **route contracts to
differently-tuned pools** and **retune as the mix shifts**. That turns the dependency chain
(§3, a one-time puzzle) into an ongoing dial — the thing you're always adjusting. (It's also the
conceptual seed of disaggregated prefill/decode, §6.)

---

## 6. The tech tree is REAL (the moat, concretely)

Each unlock is an actual serving technique with its actual tradeoff — researched/bought, then it
changes the real serving math (effective capacity, latency, memory, power). **None is a free
strictly-dominant button.**

| Tech | What it really does | The real tradeoff | When |
|---|---|---|---|
| **Continuous batching** | admit new requests as others finish instead of waiting for a static batch to drain → smooths throughput, raises utilization | foundational; the modern-serving baseline | early (foundational unlock) |
| **PagedAttention** | page the KV cache → kill fragmentation/over-reservation → pack more concurrent sequences into the same HBM | basically free *capacity*; mild complexity | early |
| **Prefix caching** | cache shared prompt prefixes (system prompts, few-shot) → skip prefill recompute → lower TTFT, freed compute | only helps workloads with shared prefixes; costs cache memory | mid |
| **Quantization (FP8/INT4)** | fewer bits → more throughput, less HBM (more concurrency), less power/token | **quality drop** → "FP16-only" contracts refuse it; a *choice*, not a default | mid |
| **Speculative decoding** | small draft model proposes tokens the big model verifies in one pass → lower TPOT, faster decode | draft model burns capacity; gain depends on acceptance rate (workload-dependent) | late |
| **Disaggregated prefill/decode** | separate GPU pools for prefill (compute-bound) vs decode (bandwidth-bound) → each runs ideal hardware + batch policy | complexity; needs scale + fast interconnect to ship KV between pools | end-game (the "advanced player" 2024–25 unlock) |

**Anti-linear hardware (keep the whole tree alive).** A100 → H100 → H200 → B200 is **not** a pure
upgrade path. Newer cards cost more capex *and* more watts. The numbers that decide are
**perf-per-dollar** and **perf-per-watt**:

- Strict-latency / biggest-model / premium contracts → newest cards win (raw perf, HBM, tail).
- Low-margin, loose-SLA, high-volume batch contracts → cheaper, lower-watt **older** cards win on
  perf/$ and perf/W.

So you run a **heterogeneous fleet** and match hardware to contract — "always buy newest" is a
trap. (This also feeds the serving-dial/disagg routing: cheap older cards in a throughput pool,
newest in a latency pool.)

---

## 7. Economy & the five meters

**Money in:** served tokens, priced **per token with input/output asymmetry** — output (decode)
tokens pay more *and* cost more (decode is sequential, bandwidth-bound, holds the GPU longer). So
**long-output contracts are lucrative but occupy capacity longer** — a real planning lever, not a
flat per-request fee.
**Money out:** capex (builds) + opex/tick (electricity, maintenance/rent, later staff). Idle
powered gear still bills — over-building is punished automatically.

**PUE unifies power + cooling.** Facility power = IT load × **PUE**. Air cooling ≈ 1.4–1.6; liquid/
immersion ≈ 1.1. One visible efficiency number ties your two hardest constraints together — and
gives cooling upgrades a clear payoff (lower PUE → lower electricity bill on the *same* compute).

**The HUD — exactly five meters, no triangle, no TTFT/TPOT:**

| Meter | Reads | The tension it shows |
|---|---|---|
| **Cash** | balance + $/min | over-provision bleeds it; penalties spike it down |
| **Power** | IT load / capacity (+ **PUE** as the efficiency readout) | the cost ceiling; cooling efficiency |
| **Cooling** | heat removed / capacity | the other hard cap; hot = throttle/fail |
| **Serving** | demand vs served (req/s) | under-provision shows demand outrunning served |
| **Contracts** | on-track / at-risk / breaching (SLA attainment) | the churn risk; where penalties come from |

(PUE is a *derived stat* shown on the Power meter, **not** a sixth meter. Latency lives inside
"Contracts" as pass/at-risk/breach — players never read raw TTFT/TPOT.)

---

## 8. Progression — earn → build → expand → unlock

- **Reputation / tier** rises with volume served and contracts honored → unlocks new hardware
  tiers, the real techniques (§6), bigger/tougher contracts, and more floor. (City-builder
  "population" milestones.)
- **Contracts are the direction** — accepting and holding a harder contract is the quest; spot/
  burst contracts are the high-risk/high-reward optional content.
- **Hazards** hit the physical build and the demand: heat wave (cooling strain), power outage
  (need UPS/generator), demand spike (a burst beyond plan), hardware failure (a server dies mid-
  contract). Each is a capacity-planning shock, not a random tax.
- **Expand**: adjacent floor → halls → (later) sites.

---

## 9. Screens / UX

| Screen | Role | Reuse |
|---|---|---|
| **Build view** (main) | iso facility + build palette; place/move/sell; ghost validity; inspector | `iso.ts`, `DatacenterFloor`, tokens |
| **HUD** | the five meters + speed controls + build/shop | TopBar styling; simple bars |
| **Contracts board** | available + active contracts; accept/decline; SLA health | toast/card styling |
| **Shop / tech tree** | hardware + the real techniques, cost + tradeoff + lock state | ServingConfig/spec-sheet styling |
| **Inspector** | tap a pool/server → stats, **serving policy dial**, upgrade, sell | ServerDetail styling |

Teaching via the existing glossary hover-cards + one-time "new tech" cards on unlock (each card
states the *real* tradeoff). Beginner-first, but never dumbed-down.

---

## 10. Mapping to the codebase

- **Reuse:** `iso.ts` (grid + heat glow), design tokens/fonts, panel styles; `DatacenterFloor`
  becomes interactive (place/select).
- **New (frontend):** placement/build system, contracts board, shop/tech tree, inspector with the
  serving dial, the five-meter HUD, economy tick, save.
- **`sim_core`, phased in:** add power capacity, cooling/heat + **PUE**, and network as real
  constraints; map a built facility to `ServingInstance` pools; make the techniques (§6) and the
  serving policy (§5) change real throughput/latency/HBM/power so contract SLAs are evaluated by
  the actual engine. Until then, P0 fakes the economy with formulas that already express the
  tension.
- **Retire from the core loop:** the Mission Control triangle screen (stash as a dev/debug view).

---

## 11. Build phases & scope discipline

**Scope rules (the part that kills solo projects):**
1. **P0 must be fun with the fake economy.** If the toy loop isn't fun, wiring `sim_core` won't
   rescue it. So P0 already includes the tension: contracts (baseline + one burst type), the
   batch↔latency dial, and visible over/under-provision pain. **Validate fun before the engine.**
2. **Multiplayer is cut.** No P4 multiplayer — it's a scope black hole. (Note it as "not in
   scope," revisit only if the single-player game is proven.)
3. **No meter creep.** Five meters, full stop. PUE stays a derived stat; TTFT/TPOT stay hidden
   inside "Contracts". Hiding them was correct — don't walk it back.

**Phases:**
- **P0 — Vertical slice (prove the fun).** Empty plot; build Power/Cooling/Rack/GPU-server with
  validity; switch on; **contracts arrive** (steady baseline + occasional burst); the
  **batch↔latency dial**; a faked-but-honest economy (capacity vs demand → served/breached → cash,
  penalties, churn); the five-meter HUD; sell. *Goal: building the right capacity for a shifting
  contract mix is already a fun decision.*
- **P1 — Depth.** Move/upgrade, network constraint, expand floor, heterogeneous pools + routing
  contracts to pools, heat glow tied to load.
- **P2 — Progression.** The real tech tree (§6) as unlocks, hardware tiers (anti-linear), shop,
  reputation, more contract types, save.
- **P3 — Real engine.** Integrate `sim_core`: techniques/policy/PUE/power/cooling become real;
  SLAs evaluated by the engine; hazards/events.
- ~~P4 — Multiplayer~~ — **cut** (see scope rule 2).

---

## 12. Open questions / assumptions

- **Real-time with pause** (build anytime, world runs on a clock) — matches existing transport.
- **Pools, not per-GPU micromanagement:** the serving dial + policy live at the *pool* level
  (a rack/group), not per card — keeps it strategic, not fiddly.
- **Contract granularity in P0:** start with ~2–3 contract archetypes (steady-baseline, strict-
  latency premium, high-margin burst) — enough to create the mix tension without overload.
- **Numbers are placeholders** — capex/opex, capacities, demand curves, SLA targets, prices all
  tuned by play (and later calibrated per `FIDELITY.md`).

---

## 13. Next step

Build **P0 — the vertical slice** (§11): an empty plot you fill with power + cooling + a rack of
GPU servers, that takes **contracts** (steady + burst), serves them under SLA via a
**batch↔latency dial**, and pays you / penalizes you accordingly — the capacity-planning loop,
playable end to end on a fake-but-honest economy. Prove it's fun, *then* wire `sim_core`.
