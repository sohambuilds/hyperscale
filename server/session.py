"""A single play session: owns one ``ClusterState`` and the real-time controls around it.

The session is the bridge between wall-clock and sim-time. The simulation advances in fixed
1-second ticks; the session decides *when* (a real-time cadence scaled by ``speed``, or a manual
``step``) and folds queued player actions into the next tick. It holds no I/O — ``app.py`` drives
it and does the sending — so it stays easy to unit-test.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from scenarios import ramp
from scenarios.ramp import Score
from server.schemas import (
    ControlMessage,
    PauseMsg,
    ResumeMsg,
    SetGpuCountMsg,
    SetSpeedMsg,
    StepMsg,
)
from sim_core.engine import catalog as _catalog
from sim_core.engine import observe, step
from sim_core.entities import ClusterState
from sim_core.types import Action, Catalog, Metrics, Observation, SetGpuCount

BASE_TICK_SECONDS: float = 0.25  # real seconds between ticks at 1x speed

# scenario name -> (build initial state, scenario length in sim-seconds)
_SCENARIOS: dict[str, tuple[Callable[[int], ClusterState], float]] = {
    "ramp": (ramp.make_state, float(ramp.DURATION_S)),
}


def scenario_names() -> list[str]:
    return sorted(_SCENARIOS)


@dataclass(slots=True)
class Session:
    """Mutable per-connection game state. Construct with :meth:`create`."""

    scenario: str
    seed: int
    state: ClusterState
    duration_s: float
    start_cash: float
    paused: bool = True  # sessions start paused; the client presses play
    speed: float = 1.0
    pending: list[Action] = field(default_factory=list)
    history: list[Metrics] = field(default_factory=list)
    done_emitted: bool = False

    @classmethod
    def create(cls, scenario: str, seed: int) -> Session:
        """Build a session for a named scenario. Raises ``KeyError`` if unknown."""
        builder, duration = _SCENARIOS[scenario]
        state = builder(seed)
        return cls(
            scenario=scenario,
            seed=seed,
            state=state,
            duration_s=duration,
            start_cash=state.cash,
        )

    @property
    def finished(self) -> bool:
        return self.state.t >= self.duration_s

    def tick_interval(self) -> float:
        return BASE_TICK_SECONDS / self.speed

    def current_observation(self) -> Observation:
        return observe(self.state)

    def catalog(self) -> Catalog:
        """Static GPU/model spec sheets for this scenario (sent once in the init frame)."""
        return _catalog(self.state)

    def advance(self) -> Observation:
        """Advance one tick, applying and clearing any queued actions."""
        _, obs, metrics = step(self.state, self.pending)
        self.pending = []
        self.history.append(metrics)
        return obs

    def score(self) -> Score:
        return ramp.score(self.history, profit=self.state.cash - self.start_cash)

    def apply_control(self, msg: ControlMessage) -> bool:
        """Apply a validated control message. Returns ``True`` if it requests an immediate tick."""
        if isinstance(msg, PauseMsg):
            self.paused = True
        elif isinstance(msg, ResumeMsg):
            self.paused = False
        elif isinstance(msg, SetSpeedMsg):
            self.speed = msg.speed
        elif isinstance(msg, SetGpuCountMsg):
            self.pending.append(SetGpuCount(instance_id=msg.instance_id, count=msg.count))
        elif isinstance(msg, StepMsg):
            return True
        return False
