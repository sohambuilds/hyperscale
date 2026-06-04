"""Workload generation: turn a serializable ``WorkloadConfig`` + the seeded RNG into the
requests that arrive each tick.

Traffic is non-uniform: a Poisson arrival process whose rate follows a piecewise-linear
schedule (``rate_points``) lets us express diurnal curves, launch ramps, and viral spikes as
plain data. Lengths are drawn from clamped lognormal distributions. Everything flows through
``state.rng`` so a run is reproducible. The ``trace``-driven mode (M4) will implement the same
``arrivals`` shape over replayed length distributions.
"""

from __future__ import annotations

import math

from sim_core.entities import LengthDist, Request, WorkloadConfig
from sim_core.rng import Rng


def rate_multiplier(cfg: WorkloadConfig, t: float) -> float:
    """Piecewise-linear interpolation of the rate schedule at time ``t`` (flat outside range)."""
    pts = cfg.rate_points
    if t <= pts[0][0]:
        return pts[0][1]
    if t >= pts[-1][0]:
        return pts[-1][1]
    for (t0, m0), (t1, m1) in zip(pts, pts[1:], strict=False):
        if t0 <= t <= t1:
            span = t1 - t0
            frac = (t - t0) / span if span > 0.0 else 0.0
            return m0 + frac * (m1 - m0)
    return pts[-1][1]


def sample_length(dist: LengthDist, rng: Rng) -> int:
    """Draw one clamped lognormal length (tokens)."""
    value = int(rng.lognormal(math.log(dist.median), dist.sigma))
    return max(dist.min_len, min(dist.max_len, value))


def sample_arrivals(
    cfg: WorkloadConfig,
    t: float,
    dt: float,
    rng: Rng,
    next_id: int,
) -> list[Request]:
    """Sample the requests that arrive during ``[t, t+dt)``.

    Returns newly-created requests with ids ``next_id, next_id+1, ...``. The number of
    arrivals is Poisson with mean ``base_rate * rate_multiplier(t) * dt``.
    """
    lam = cfg.base_rate * rate_multiplier(cfg, t) * dt
    n = rng.poisson(lam)
    requests: list[Request] = []
    for i in range(n):
        requests.append(
            Request(
                id=next_id + i,
                arrive_t=t,
                input_len=sample_length(cfg.input_dist, rng),
                target_output_len=sample_length(cfg.output_dist, rng),
            )
        )
    return requests
