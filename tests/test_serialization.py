"""Serialization round-trips losslessly: a restored snapshot steps identically to the original,
including mid-flight requests and the RNG bit-state. This is what makes replays, RL resets, and
(later) multiplayer authority possible — the snapshot *is* the simulation."""

import dataclasses

from sim_core.engine import step
from sim_core.entities import ClusterState
from sim_core.serialization import (
    state_from_dict,
    state_from_json,
    state_to_dict,
    state_to_json,
)


def _warm(state: ClusterState, ticks: int) -> None:
    for _ in range(ticks):
        step(state, [])


def test_dict_round_trip_preserves_state(state: ClusterState) -> None:
    _warm(state, 12)  # populate running batch, queue, recent_completed, and advance the RNG
    restored = state_from_dict(state_to_dict(state))
    assert state_to_dict(restored) == state_to_dict(state)


def test_json_round_trip_then_step_matches(state: ClusterState) -> None:
    _warm(state, 12)
    restored = state_from_json(state_to_json(state))
    for _ in range(15):
        _, _, a = step(state, [])
        _, _, b = step(restored, [])
        assert dataclasses.astuple(a) == dataclasses.astuple(b)


def test_snapshot_reproduces_future_trajectory(state: ClusterState) -> None:
    # Snapshot, run the original forward, then restore and replay — identical metrics.
    _warm(state, 8)
    snapshot = state_to_json(state)
    forward = [dataclasses.astuple(step(state, [])[2]) for _ in range(20)]
    restored = state_from_json(snapshot)
    replay = [dataclasses.astuple(step(restored, [])[2]) for _ in range(20)]
    assert forward == replay
