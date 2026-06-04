"""The simulation core: one pure, deterministic function.

``step()`` advances the simulation by one fixed tick. It mutates ``state`` in place (for speed
in RL rollouts and real-time play) and returns it, alongside the observation and metrics for
the tick. Determinism is the contract: identical starting state (including the RNG carried in
``state.rng``) plus identical actions always produce identical output. No I/O, no wall-clock,
no global RNG. Snapshot via ``serialization`` before stepping if you need the prior state.

Per-tick model (dt = TICK_SECONDS). For each instance:
  1. abandon queued requests past patience (churn);
  2. admit from the queue into the running batch while the KV budget allows;
  3. prefill phase — compute-bound; advances pending prefills, sets first-token times;
  4. decode phase — bandwidth-bound; runs in the time left after prefill (so a big prefill
     stalls decode, which is exactly what chunked prefill will later fix);
  5. complete finished sequences and record their latencies.
Then bill GPU + power, accrue revenue on SLO-meeting ("good") tokens, and collect metrics.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from sim_core.economics import energy_cost, gpu_rental_cost, instance_power_w
from sim_core.entities import ClusterState, Request, ServingInstance, SloConfig
from sim_core.physics import (
    decode_step_time,
    kv_bytes_per_token,
    max_concurrent_tokens,
    per_gpu_weight_bytes,
    tp_comm_overhead,
)
from sim_core.scheduler import admit, drop_expired, footprint
from sim_core.types import (
    Action,
    Catalog,
    GpuTypeView,
    InstanceView,
    Metrics,
    ModelView,
    Observation,
    SetGpuCount,
)
from sim_core.workload import sample_arrivals

TICK_SECONDS: float = 1.0  # one simulated second per tick (sub-stepping comes later)
MFU: float = 0.4  # achieved fraction of peak FLOP/s during prefill (constant for M1)


def step(
    state: ClusterState,
    actions: Sequence[Action],
) -> tuple[ClusterState, Observation, Metrics]:
    """Advance the simulation by one tick. See the module docstring for the contract."""
    dt = TICK_SECONDS
    _apply_actions(state, actions)

    new_reqs = sample_arrivals(state.workload, state.t, dt, state.rng, state.next_request_id)
    state.next_request_id += len(new_reqs)
    _route(state, new_reqs)

    tick_tokens = 0
    tick_good_tokens = 0
    churned = 0
    completed = 0
    utils: list[float] = []
    kv_pressures: list[float] = []
    total_power_w = 0.0

    for inst in state.instances:
        churned += drop_expired(inst, state.t, state.slo.max_queue_wait_s)

        # Requests that finished prefill in an earlier tick are eligible to decode now.
        decoders = [r for r in inst.running if r.prefill_done and r.done_t is None]

        max_tokens = max_concurrent_tokens(
            inst.model, inst.gpu, inst.gpu_count, inst.tp, inst.pp, inst.paged_efficiency
        )
        admit(inst, max_tokens, state.t)

        prefill_used_t, _ = _do_prefill(inst, state.t, dt, _prefill_rate(inst))
        remaining_t = max(0.0, dt - prefill_used_t)

        step_time = _decode_step_time_for(inst)
        gen, good, newly_done = _do_decode(
            inst, decoders, remaining_t, step_time, state.slo, state.t, dt
        )
        tick_tokens += gen
        tick_good_tokens += good
        completed += len(newly_done)
        for req in newly_done:
            state.recent_completed.append(req)

        decode_used_t = remaining_t if gen > 0 else 0.0
        util = min(1.0, (prefill_used_t + decode_used_t) / dt)
        inst.last_util = util  # surface for the observation/dashboard (not read by physics)
        utils.append(util)
        used_fp = sum(footprint(r) for r in inst.running)
        kv_pressures.append(used_fp / max_tokens if max_tokens > 0 else 1.0)
        total_power_w += instance_power_w(inst, util)

    cost = sum(gpu_rental_cost(i, dt) for i in state.instances)
    energy = energy_cost(total_power_w, state.pue, state.price_per_wh, dt)
    revenue = tick_good_tokens * state.price_per_token
    state.cash += revenue - cost - energy

    state.t += dt

    metrics = _collect_metrics(
        state=state,
        dt=dt,
        tick_tokens=tick_tokens,
        tick_good_tokens=tick_good_tokens,
        completed=completed,
        churned=churned,
        utils=utils,
        kv_pressures=kv_pressures,
        power_w=total_power_w,
        cost=cost,
        energy=energy,
        revenue=revenue,
    )
    return state, _observe(state, metrics), metrics


# --- action application -------------------------------------------------------------------
def _apply_actions(state: ClusterState, actions: Sequence[Action]) -> None:
    by_id = {i.id: i for i in state.instances}
    for action in actions:
        if isinstance(action, SetGpuCount):
            inst = by_id.get(action.instance_id)
            if inst is None:
                continue
            avail = state.free_gpus.get(inst.gpu.name, 0)
            delta = max(0, action.count) - inst.gpu_count
            if delta > 0:
                delta = min(delta, avail)  # can't allocate GPUs you don't have
            inst.gpu_count += delta
            state.free_gpus[inst.gpu.name] = avail - delta


def _route(state: ClusterState, new_reqs: list[Request]) -> None:
    if not state.instances:
        return
    n = len(state.instances)
    for idx, req in enumerate(new_reqs):
        state.instances[idx % n].queue.append(req)


# --- prefill (compute-bound) --------------------------------------------------------------
def _prefill_rate(inst: ServingInstance) -> float:
    """Prefill throughput (tokens/sec): achievable FLOP/s divided by ~2N FLOPs per token."""
    eff_flops = inst.gpu_count * inst.gpu.peak_flops * MFU
    return eff_flops / (2.0 * inst.model.num_params)


def _do_prefill(inst: ServingInstance, t: float, dt: float, rate: float) -> tuple[float, int]:
    """Advance pending prefills FIFO within this tick. Returns (time_used_s, n_first_tokens)."""
    capacity = int(rate * dt)
    if rate <= 0.0 or capacity <= 0:
        return 0.0, 0
    remaining = capacity
    processed = 0
    first_tokens = 0
    for req in inst.running:
        if remaining <= 0:
            break
        if req.prefill_done:
            continue
        take = min(req.input_len - req.prefilled, remaining)
        if take <= 0:
            continue
        req.prefilled += take
        remaining -= take
        processed += take
        if req.prefill_done and req.first_token_t is None:
            req.first_token_t = t + processed / rate
            first_tokens += 1
    return processed / rate, first_tokens


# --- decode (bandwidth-bound) -------------------------------------------------------------
def _decode_step_time_for(inst: ServingInstance) -> float:
    """Per-decode-step (per-output-token) latency for the instance's current batch."""
    replicas = max(1, inst.gpu_count // (inst.tp * inst.pp))
    live_tokens = sum(r.live_tokens for r in inst.running)
    kv_per_replica = (live_tokens / replicas) * kv_bytes_per_token(inst.model)
    weight = per_gpu_weight_bytes(inst.model, inst.tp)
    comm = tp_comm_overhead(inst.tp, inst.gpu.interconnect)
    return decode_step_time(weight, kv_per_replica, inst.gpu.hbm_bw_gbs, comm)


def _do_decode(
    inst: ServingInstance,
    decoders: list[Request],
    remaining_t: float,
    step_time: float,
    slo: SloConfig,
    t: float,
    dt: float,
) -> tuple[int, int, list[Request]]:
    """Advance the decoding batch in the time left this tick. Returns (generated_tokens,
    good_tokens, newly_completed)."""
    if not decoders or step_time <= 0.0 or remaining_t <= 0.0:
        return 0, 0, []
    steps = int(remaining_t / step_time)
    if steps <= 0:
        return 0, 0, []
    tpot_ok = step_time <= slo.tpot_target_s
    generated = 0
    good = 0
    newly_done: list[Request] = []
    for req in decoders:
        n = min(steps, req.target_output_len - req.generated)
        if n <= 0:
            continue
        req.generated += n
        generated += n
        ttft = req.first_token_t - req.arrive_t if req.first_token_t is not None else 0.0
        if tpot_ok and ttft <= slo.ttft_target_s:
            good += n
        if req.generated >= req.target_output_len:
            req.done_t = t + dt
            newly_done.append(req)
    for req in newly_done:
        inst.running.remove(req)
    return generated, good, newly_done


# --- metrics & observation ----------------------------------------------------------------
def _percentiles(values: list[float]) -> tuple[float, float, float]:
    if not values:
        return 0.0, 0.0, 0.0
    arr = np.asarray(values, dtype=float)
    p = np.percentile(arr, [50.0, 95.0, 99.0])
    return float(p[0]), float(p[1]), float(p[2])


def _completion_stats(state: ClusterState) -> tuple[list[float], list[float], list[bool]]:
    ttfts: list[float] = []
    tpots: list[float] = []
    slo_flags: list[bool] = []
    for req in state.recent_completed:
        if req.first_token_t is None or req.done_t is None:
            continue
        ttft = req.first_token_t - req.arrive_t
        tpot = (req.done_t - req.first_token_t) / max(req.generated - 1, 1)
        ttfts.append(ttft)
        tpots.append(tpot)
        slo_flags.append(ttft <= state.slo.ttft_target_s and tpot <= state.slo.tpot_target_s)
    return ttfts, tpots, slo_flags


def _collect_metrics(
    *,
    state: ClusterState,
    dt: float,
    tick_tokens: int,
    tick_good_tokens: int,
    completed: int,
    churned: int,
    utils: list[float],
    kv_pressures: list[float],
    power_w: float,
    cost: float,
    energy: float,
    revenue: float,
) -> Metrics:
    ttfts, tpots, slo_flags = _completion_stats(state)
    ttft_p50, ttft_p95, ttft_p99 = _percentiles(ttfts)
    tpot_p50, tpot_p95, tpot_p99 = _percentiles(tpots)
    per_hour = 3600.0 / dt
    return Metrics(
        t=state.t,
        ttft_p50=ttft_p50,
        ttft_p95=ttft_p95,
        ttft_p99=ttft_p99,
        tpot_p50=tpot_p50,
        tpot_p95=tpot_p95,
        tpot_p99=tpot_p99,
        throughput_tok_s=tick_tokens / dt,
        goodput_tok_s=tick_good_tokens / dt,
        gpu_util=float(np.mean(utils)) if utils else 0.0,
        kv_pressure=max(kv_pressures) if kv_pressures else 0.0,
        power_w=power_w,
        power_budget_w=state.power_budget_w,
        cost_per_hour=(cost + energy) * per_hour,
        revenue_per_hour=revenue * per_hour,
        slo_attainment=(sum(slo_flags) / len(slo_flags)) if slo_flags else 1.0,
        queue_depth=sum(len(i.queue) for i in state.instances),
        requests_completed=completed,
        requests_churned=churned,
    )


def _zero_metrics(state: ClusterState) -> Metrics:
    """Metrics for a state that hasn't been stepped yet (server init, RL reset)."""
    return Metrics(
        t=state.t,
        ttft_p50=0.0,
        ttft_p95=0.0,
        ttft_p99=0.0,
        tpot_p50=0.0,
        tpot_p95=0.0,
        tpot_p99=0.0,
        throughput_tok_s=0.0,
        goodput_tok_s=0.0,
        gpu_util=0.0,
        kv_pressure=0.0,
        power_w=0.0,
        power_budget_w=state.power_budget_w,
        cost_per_hour=0.0,
        revenue_per_hour=0.0,
        slo_attainment=1.0,
        queue_depth=sum(len(i.queue) for i in state.instances),
        requests_completed=0,
        requests_churned=0,
    )


def observe(state: ClusterState) -> Observation:
    """A read-only Observation of the current state, without advancing it.

    Used for the server's initial frame and (later) an RL ``reset()`` observation."""
    return _observe(state, _zero_metrics(state))


def _observe(state: ClusterState, metrics: Metrics) -> Observation:
    views: list[InstanceView] = []
    for inst in state.instances:
        max_tokens = max_concurrent_tokens(
            inst.model, inst.gpu, inst.gpu_count, inst.tp, inst.pp, inst.paged_efficiency
        )
        used = sum(footprint(r) for r in inst.running)
        views.append(
            InstanceView(
                instance_id=inst.id,
                model_name=inst.model.name,
                gpu_name=inst.gpu.name,
                gpu_count=inst.gpu_count,
                tp=inst.tp,
                pp=inst.pp,
                quant=inst.quant,
                running=len(inst.running),
                queued=len(inst.queue),
                kv_pressure=used / max_tokens if max_tokens > 0 else 1.0,
                gpu_util=inst.last_util,
                power_w=instance_power_w(inst, inst.last_util),
            )
        )
    return Observation(
        metrics=metrics,
        cash=state.cash,
        free_gpus=dict(state.free_gpus),
        instances=views,
    )


def catalog(state: ClusterState) -> Catalog:
    """Static spec sheets for every GPU type and model present in the cluster.

    De-duplicated by name. Pure and read-only — the server sends this once at init so the UI
    can render hardware detail panels without carrying specs in every per-tick observation.
    """
    gpus: dict[str, GpuTypeView] = {}
    models: dict[str, ModelView] = {}
    for inst in state.instances:
        g = inst.gpu
        if g.name not in gpus:
            gpus[g.name] = GpuTypeView(
                name=g.name,
                hbm_gb=g.hbm_gb,
                hbm_bw_gbs=g.hbm_bw_gbs,
                peak_flops=g.peak_flops,
                power_w=g.power_w,
                cost_per_hour=g.cost_per_hour,
                interconnect=g.interconnect,
            )
        m = inst.model
        if m.name not in models:
            models[m.name] = ModelView(
                name=m.name,
                num_params=m.num_params,
                num_layers=m.num_layers,
                num_kv_heads=m.num_kv_heads,
                head_dim=m.head_dim,
                dtype_bytes=m.dtype_bytes,
                kv_bytes=m.kv_bytes,
            )
    return Catalog(gpus=list(gpus.values()), models=list(models.values()))
