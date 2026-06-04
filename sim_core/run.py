"""Headless CLI runner: drive a scenario open-loop and stream the metrics.

    python -m sim_core.run --scenario ramp --seed 1
    python -m sim_core.run --scenario ramp --seed 1 --format jsonl > run.jsonl

This is the engine-first payoff — you can watch the simulation behave before any server or UI
exists. It is the one ``sim_core`` module that does I/O (argparse + stdout); the core itself
stays pure. Output is a pure function of ``--scenario`` and ``--seed``: same inputs, same bytes.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import sys
from collections.abc import Callable

from scenarios import ramp
from sim_core.engine import step
from sim_core.entities import ClusterState
from sim_core.types import Metrics

SCENARIOS: dict[str, Callable[[int], ClusterState]] = {
    "ramp": ramp.make_state,
}

_HEADER = (
    f"{'t':>6} {'ttft95':>8} {'tpot95':>8} {'thru':>9} {'good':>9} "
    f"{'util':>5} {'kvp':>5} {'slo':>5} {'queue':>6} {'cash':>12}"
)


def _format_row(m: Metrics, cash: float) -> str:
    return (
        f"{m.t:6.0f} {m.ttft_p95 * 1e3:7.1f}m {m.tpot_p95 * 1e3:7.1f}m "
        f"{m.throughput_tok_s:9.0f} {m.goodput_tok_s:9.0f} "
        f"{m.gpu_util * 100:4.0f}% {m.kv_pressure * 100:4.0f}% "
        f"{m.slo_attainment * 100:4.0f}% {m.queue_depth:6d} {cash:12.2f}"
    )


def run(scenario: str, seed: int, ticks: int, fmt: str, every: int) -> int:
    """Run ``ticks`` steps of a scenario, printing metrics. Returns a process exit code."""
    builder = SCENARIOS.get(scenario)
    if builder is None:
        print(f"unknown scenario {scenario!r}; choose from {sorted(SCENARIOS)}", file=sys.stderr)
        return 2

    state = builder(seed)
    start_cash = state.cash
    history: list[Metrics] = []

    if fmt == "text":
        print(_HEADER)
    for i in range(ticks):
        _, obs, m = step(state, [])
        history.append(m)
        if fmt == "jsonl":
            print(json.dumps(dataclasses.asdict(m)))
        elif i % every == 0 or i == ticks - 1:
            print(_format_row(m, obs.cash))

    result = ramp.score(history, profit=state.cash - start_cash)
    if fmt == "text":
        print(
            f"\nprofit ${result.profit:,.2f} | slo {result.mean_slo_attainment * 100:.1f}% | "
            f"reliability {result.reliability * 100:.1f}% | "
            f"completed {result.requests_completed} | churned {result.requests_churned}"
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="sim_core.run", description=__doc__)
    parser.add_argument("--scenario", default="ramp", choices=sorted(SCENARIOS))
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--ticks", type=int, default=ramp.DURATION_S)
    parser.add_argument("--format", default="text", choices=("text", "jsonl"))
    parser.add_argument("--every", type=int, default=30, help="text mode: print every N ticks")
    args = parser.parse_args(argv)
    return run(args.scenario, args.seed, args.ticks, args.format, max(1, args.every))


if __name__ == "__main__":
    raise SystemExit(main())
