"""The single seeded RNG, carried inside ``ClusterState``.

All stochasticity in the simulator flows through one ``Rng`` so that runs are reproducible
and snapshot/restore is exact. numpy's PCG64 bit-generator state is plain ints, so it
serializes cleanly for replays and RL episode resets.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np


@dataclass(slots=True)
class Rng:
    """Thin wrapper over a numpy ``Generator`` with explicit, serializable state."""

    gen: np.random.Generator

    @classmethod
    def from_seed(cls, seed: int) -> Rng:
        return cls(np.random.default_rng(seed))

    def poisson(self, lam: float) -> int:
        return int(self.gen.poisson(lam))

    def lognormal(self, mean: float, sigma: float) -> float:
        return float(self.gen.lognormal(mean, sigma))

    def integers(self, low: int, high: int) -> int:
        """Uniform integer in ``[low, high)``."""
        return int(self.gen.integers(low, high))

    def random(self) -> float:
        """Uniform float in ``[0, 1)``."""
        return float(self.gen.random())

    # --- snapshot / restore -----------------------------------------------------------
    def get_state(self) -> dict[str, Any]:
        state: dict[str, Any] = dict(self.gen.bit_generator.state)
        return state

    def set_state(self, state: dict[str, Any]) -> None:
        self.gen.bit_generator.state = state
