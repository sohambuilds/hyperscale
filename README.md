# Hyperscaler (working title: INFERENCE)

A **datacenter tycoon simulator for serving LLMs at scale**. You run inference for an AI
lab: buy/rent GPUs, choose how to serve each model (batching, quantization, parallelism,
caching, speculative decoding), set autoscaling and routing, and survive the hard triangle
of **latency SLOs vs. cost/power vs. incoming traffic**.

The architectural bet: the simulation is a **pure, deterministic, headless Python core**
(`sim_core`) exposing one function —

```python
step(state, actions, rng) -> (next_state, observation, metrics)
```

Everything else (web UI, multiplayer, a future RL environment) is a thin shell around it.

## Status

Early build. See [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) for the roadmap,
[`docs/STEP_CONTRACT.md`](docs/STEP_CONTRACT.md) for the engine contract, and
[`docs/FIDELITY.md`](docs/FIDELITY.md) for the documented modeling simplifications.

## Develop

```bash
uv sync                 # create .venv, install deps (numpy + dev tooling)
uv run pytest           # run the test suite
uv run ruff check .     # lint
uv run mypy             # type-check the core
uv run python -m sim_core.run --scenario ramp --seed 1   # headless run (once the engine lands)
```

Requires [uv](https://docs.astral.sh/uv/) and Python >= 3.12.
