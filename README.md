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

## Play the builder (datacenter construction tycoon)

The game is a from-scratch datacenter **construction tycoon** — build power, cooling, racks and
GPU servers on an isometric floor, sign SLA contracts, and balance capacity against bursty
demand. Design: [`docs/BUILDER.md`](docs/BUILDER.md). It runs entirely in the browser (no
backend needed; the sim engine integrates later).

```bash
cd frontend
npm install
npm run dev        # play at http://localhost:5173
npm run build      # static site in frontend/dist/
```

**Deploy:** `frontend/dist/` is a plain static bundle — drop it on any static host
(Vercel/Netlify/GitHub Pages/itch.io). No server required. e.g. with Vercel:
`cd frontend && npm run build && npx vercel deploy --prebuilt dist` (or point the host at the
`frontend` dir with build command `npm run build` and output `dist`). Progress saves to
`localStorage`, so a single static page is all you need.
