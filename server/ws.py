"""Outbound wire framing: turn engine outputs into the JSON envelopes the client receives.

Three message kinds go out — ``init`` (one per connection), ``tick`` (one per advanced tick),
and ``done`` (once, when the scenario's clock runs out). Each is a plain dict built from the
contract dataclasses via ``asdict``, so the wire shape tracks ``sim_core.types`` automatically.
(Broadcast to multiple spectators is an M3 concern; M1 is one client per session.)
"""

from __future__ import annotations

import dataclasses
from typing import Any

from scenarios.ramp import Score
from sim_core.types import Catalog, Observation


def init_payload(
    *,
    scenario: str,
    seed: int,
    tick_seconds: float,
    duration_s: float,
    speed: float,
    paused: bool,
    observation: Observation,
    catalog: Catalog,
) -> dict[str, Any]:
    return {
        "type": "init",
        "scenario": scenario,
        "seed": seed,
        "tick_seconds": tick_seconds,
        "duration_s": duration_s,
        "speed": speed,
        "paused": paused,
        "observation": dataclasses.asdict(observation),
        "catalog": dataclasses.asdict(catalog),
    }


def tick_payload(observation: Observation) -> dict[str, Any]:
    return {"type": "tick", "observation": dataclasses.asdict(observation)}


def done_payload(observation: Observation, score: Score) -> dict[str, Any]:
    return {
        "type": "done",
        "observation": dataclasses.asdict(observation),
        "score": dataclasses.asdict(score),
    }
