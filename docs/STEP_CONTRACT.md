# The `step()` contract

`sim_core` exposes one function. Everything else (web UI, multiplayer, RL environment) is a
shell around it.

```python
def step(state: ClusterState, actions: Sequence[Action]) -> tuple[ClusterState, Observation, Metrics]
```

## Guarantees

- **Deterministic.** Identical starting `state` (including the RNG carried in `state.rng`)
  plus an identical `actions` sequence always produces identical output — bit-for-bit.
- **Pure of I/O.** No file/network/clock access; no global RNG. All randomness flows through
  `state.rng` (a seeded numpy `Generator`, see [`sim_core/rng.py`](../sim_core/rng.py)).
- **In-place for speed.** `step` mutates `state` and returns the same object. If you need the
  prior state (replays, RL resets), snapshot it via `serialization` *before* stepping.

> Note: the RNG lives **inside** `state` rather than being a separate `step` parameter, so a
> single snapshot of `state` captures the entire reproducible position.

## The tick

Fixed tick = `TICK_SECONDS` (1 simulated second to start; sub-stepping for finer decode
resolution comes later). Each call:

1. `apply(actions)` — buy/sell GPUs, reconfigure, scale, price, route (M1: `SetGpuCount`).
2. `workload.sample(t)` — stochastic arrivals for this tick.
3. `route` — assign new requests to instances.
4. per instance: `schedule` (continuous-batch admission while KV budget allows) →
   `prefill chunk` → `decode one token` → `complete finished` (record TTFT/TPOT/e2e).
5. `bill` — GPU cost + power×PUE; revenue in business mode.
6. `maybe_fire_event` — surges/failures/launches (stubbed in M1).
7. `collect` — `Metrics` (goodput, p50/p95/p99, util, KV pressure, $/hr, power, SLO%).

## The types (durable artifact)

See [`sim_core/types.py`](../sim_core/types.py).

- **`Action`** — what a player/agent sends. M1 ships one verb, `SetGpuCount(instance_id, count)`.
  Later milestones widen it into a tagged union (`SetPrice`, `ConfigureInstance`, `BuyGpu`,
  `SetRoutingPolicy`, …).
- **`Metrics`** — the per-tick scalar dashboard; latency is reported as p50/p95/p99 because
  averages hide the tail that actually causes churn.
- **`Observation`** — the per-tick rollup handed to a player or RL agent (`Metrics` + cash +
  free GPUs + per-instance `InstanceView`s). The RL wrapper later flattens this to a vector.
