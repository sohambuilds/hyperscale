# INFERENCE — Build Plan (M0 + M1 detailed, M2–M4 roadmap)

## Context

A **datacenter tycoon simulator for serving LLMs at scale**, built so that one deterministic,
headless `step()` function is the durable core and the web UI, multiplayer, and a future RL
environment are thin shells around it.

**Chosen path:** Python engine-first. Build and unit-test the deterministic `sim_core`
headless (M1 steps 1–5), *then* add FastAPI + React (steps 6–8). No rewrite later.

**The bet that makes everything else cheap:** `sim_core` is pure — no I/O, no framework
imports, all randomness through a seeded RNG carried in state, state serializable to
JSON/msgpack. Get that right and the server, multiplayer authority, and Gym wrapper are
plumbing.

## Tooling

- **Python 3.12**, env/deps via **`uv`**.
- **numpy** — physics math + the single seeded RNG (`numpy.random.default_rng`; PCG64
  bit-state is serializable for snapshot/restore).
- **pytest** (+ `pytest-cov`), **ruff** (lint+format), **mypy** (strict).
- **FastAPI + uvicorn + websockets** — server (M1 step 6).
- **Vite + React + TypeScript** — frontend (M1 step 7); uPlot for streaming charts.
- **GitHub Actions** CI: ruff + mypy + pytest.

## Repo structure (target by end of M1)

```
sim_core/        # THE CORE — pure, deterministic, no I/O, no framework imports
  types.py         # Action / Observation / Metrics (the contract)
  entities.py      # GpuType, ModelSpec, Request, ServingInstance, ClusterState
  rng.py           # seeded RNG wrapper + state snapshot/restore
  workload.py      # Poisson arrivals + length distributions (pluggable synthetic|trace)
  physics.py       # roofline: KV ceiling, decode step time, prefill time (pure fns)
  scheduler.py     # continuous-batching admission
  economics.py     # gpu cost, power×PUE, revenue, bankruptcy/power-trip checks
  events.py        # event injectors (stub in M1)
  engine.py        # step(state, actions) -> (next_state, observation, metrics)
  serialization.py # state <-> json (snapshot/restore, replays, RL resets)
  run.py           # headless CLI runner
scenarios/ramp.py  # M1 scenario (10-min traffic ramp) + scoring
server/            # FastAPI + WebSocket (M1 step 6; imports sim_core, never the reverse)
frontend/          # Vite + React + TS (M1 step 7)
tests/             # physics / workload / engine / determinism (golden trajectory)
docs/              # this plan, STEP_CONTRACT.md, FIDELITY.md
```

## M0 — Skeleton (done)

git + uv + pyproject; typed `sim_core` package; the `step()` contract written first
(`types.py` + `STEP_CONTRACT.md`); `FIDELITY.md`; smoke tests; green CI (ruff + mypy +
pytest).

## M1 — Playable vertical slice (engine-first; also the tutorial)

### Phase A — headless, tested engine (steps 1–5)

1. **Data model** (`entities.py`) — dataclasses §3.1, minimal (one GPU, one model).
2. **Workload + RNG** (`workload.py`, `rng.py`) — Poisson arrivals at λ(t) + length
   distributions; same seed ⇒ identical arrivals.
3. **Physics** (`physics.py`) — KV ceiling, decode step time (bandwidth-bound), prefill time
   (compute-bound); each unit-tested against hand-computed values.
4. **Scheduler + engine** (`scheduler.py`, `economics.py`, `engine.py`) — continuous-batch
   admission; advance prefill/decode; complete; bill; collect p50/p95/p99.
5. **Determinism + golden trajectory + notebook** — same seed+actions ⇒ identical metrics
   hash; notebook to watch the curves.

### Phase B — interactive and scored (steps 6–8)

6. **FastAPI + WebSocket** (`server/`) — a session ticking on a timer (pause/1×/2×/4×),
   streaming metrics, ingesting `SetGpuCount`.
7. **React dashboard** (`frontend/`) — TTFT/TPOT histograms with p95, throughput, GPU util,
   $/hr; a GPU-count control; pause/play/speed.
8. **Scenario + score** (`scenarios/ramp.py`) — 10-min ramp; composite score (profit + SLO
   uptime% + tokens/$ + tokens/W); results screen.

### Bake in now so M3/M4 stay cheap

`step()` pure & deterministic; state serializable (round-trip test); optional trajectory
recorder hook; every approximation logged in `FIDELITY.md`.

## Verification

- `uv run pytest` — physics unit tests vs closed-form values; workload determinism; `step()`
  integration; golden-trajectory hash; serialization round-trip; `sim_core` purity test.
- Determinism: run the CLI twice with a fixed seed, diff metrics — identical.
- Qualitative physics: more GPUs ⇒ lower TTFT; oversized batch ⇒ higher throughput but worse
  TPOT tail; too few GPUs ⇒ queue explosion, p99 spike, churn; long context ⇒ KV pressure caps batch.
- Web loop: run server + frontend, watch dashboards respond to `SetGpuCount`, finish the ramp.

## M2–M4 — roadmap (outline)

- **M2 Fidelity & knobs:** quantization (FP16/FP8/INT4), TP/PP penalties, multi-GPU/model,
  power/PUE hard-fail, autoscaling with cold-start lag, routing policies, prefix caching,
  speculative decoding, chunked prefill; workload profile mixture; events. Stretch:
  disaggregated prefill/decode pools.
- **M3 Multiplayer:** rooms; shared seeded match; shared GPU supply market + customer pool;
  turn-based first for fairness; leaderboard/spectator UI.
- **M4 Research env:** Gymnasium-style wrapper; trace-driven workloads; trajectory logging;
  calibration harness fitting constants to real serving benchmarks within a stated error band.

## Risks / decisions

- **Fidelity vs playability** — fidelity ladder + `FIDELITY.md`.
- **Calibration data** — resolve before M4; keep work/Cisco context separate.
- **`step()` perf** — allocation-light, numpy hot paths.
- **Multiplayer fairness** — turn-based first.
- **Scope creep** — M1 ships one model, one GPU, one scenario.
