"""Workload tests: arrivals are reproducible under a fixed seed, the rate schedule
interpolates, and sampled lengths stay within bounds."""

import statistics

import pytest

from sim_core.entities import LengthDist, WorkloadConfig
from sim_core.rng import Rng
from sim_core.workload import rate_multiplier, sample_arrivals, sample_length


def test_arrivals_deterministic(workload: WorkloadConfig) -> None:
    a = sample_arrivals(workload, t=0.0, dt=1.0, rng=Rng.from_seed(1), next_id=0)
    b = sample_arrivals(workload, t=0.0, dt=1.0, rng=Rng.from_seed(1), next_id=0)
    assert [(r.input_len, r.target_output_len) for r in a] == [
        (r.input_len, r.target_output_len) for r in b
    ]


def test_arrival_ids_are_sequential(workload: WorkloadConfig) -> None:
    reqs = sample_arrivals(workload, t=0.0, dt=5.0, rng=Rng.from_seed(2), next_id=100)
    assert [r.id for r in reqs] == list(range(100, 100 + len(reqs)))


def test_rate_multiplier_interpolates() -> None:
    cfg = WorkloadConfig(
        base_rate=1.0,
        input_dist=LengthDist(10.0, 0.1, 1, 100),
        output_dist=LengthDist(10.0, 0.1, 1, 100),
        rate_points=((0.0, 1.0), (100.0, 11.0)),
    )
    assert rate_multiplier(cfg, -5.0) == 1.0  # flat before the first point
    assert rate_multiplier(cfg, 0.0) == 1.0
    assert rate_multiplier(cfg, 50.0) == pytest.approx(6.0)  # halfway: 1 + 0.5*10
    assert rate_multiplier(cfg, 100.0) == 11.0
    assert rate_multiplier(cfg, 200.0) == 11.0  # flat after the last point


def test_higher_rate_yields_more_arrivals(workload: WorkloadConfig) -> None:
    # Averaged over many seeds, arrivals should grow with the rate multiplier.
    low = statistics.mean(
        len(sample_arrivals(workload, 0.0, 1.0, Rng.from_seed(s), 0)) for s in range(50)
    )
    ramped = WorkloadConfig(
        base_rate=workload.base_rate,
        input_dist=workload.input_dist,
        output_dist=workload.output_dist,
        rate_points=((0.0, 5.0),),
    )
    high = statistics.mean(
        len(sample_arrivals(ramped, 0.0, 1.0, Rng.from_seed(s), 0)) for s in range(50)
    )
    assert high > low


def test_lengths_within_bounds() -> None:
    dist = LengthDist(median=50.0, sigma=1.5, min_len=5, max_len=200)
    rng = Rng.from_seed(3)
    for _ in range(1000):
        v = sample_length(dist, rng)
        assert 5 <= v <= 200
