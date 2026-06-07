"""Act-I campaign levels — gentle variations on the ramp so each level teaches one thing.

These reuse ``ramp.build_state`` (same H100 / llama-8b catalog, same prices) and only vary the
difficulty knobs, so there's a single source of truth for the hardware. Durations are exported
so the server can register them alongside ``ramp`` without hardcoding magic numbers.

See ``docs/PROGRESSION.md`` for the campaign design.
"""

from __future__ import annotations

from scenarios.ramp import build_state
from sim_core.entities import ClusterState

# Level 1 — "First Tokens": a gentle, short ramp you can win while learning the controls.
CADET_DURATION_S: float = 300.0


def make_cadet(seed: int) -> ClusterState:
    return build_state(
        seed,
        base_rate=30.0,  # ~30 → ~90 req/s — comfortable for the starting 4 GPUs
        peak=3.0,
        duration=CADET_DURATION_S,
        gpu_count=4,
        power_budget_w=14_000.0,  # generous headroom; the cost corner isn't the lesson yet
    )


# Level 3 — "Mind the Meter": same flood as the full ramp, but a tight power budget so the
# cost & power corner bites. Teaches efficiency (tokens per dollar / per watt).
CRUNCH_DURATION_S: float = 600.0


def make_crunch(seed: int) -> ClusterState:
    return build_state(
        seed,
        base_rate=50.0,
        peak=6.0,
        duration=CRUNCH_DURATION_S,
        gpu_count=4,
        power_budget_w=8_000.0,  # tighter: brute-force scaling lights up the cost gauge fast
    )
