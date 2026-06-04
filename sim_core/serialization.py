"""Snapshot / restore for ``ClusterState`` (design §3.1: replays, RL episode resets,
multiplayer authority).

The whole state is plain data — dataclasses, dicts, deques, and the RNG's integer bit-state —
so it round-trips through JSON losslessly. Restoring a snapshot and stepping it reproduces the
original trajectory bit-for-bit, which is the determinism contract the rest of the project
leans on. msgpack (a faster, smaller wire format over the same dict shape) can come later.
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import asdict
from typing import Any

from sim_core.entities import (
    ClusterState,
    GpuType,
    LengthDist,
    ModelSpec,
    Request,
    ServingInstance,
    SloConfig,
    WorkloadConfig,
)
from sim_core.rng import Rng

RECENT_COMPLETED_MAXLEN: int = 512  # mirror the ClusterState default


def _request_from_dict(d: dict[str, Any]) -> Request:
    return Request(
        id=d["id"],
        arrive_t=d["arrive_t"],
        input_len=d["input_len"],
        target_output_len=d["target_output_len"],
        admit_t=d["admit_t"],
        first_token_t=d["first_token_t"],
        done_t=d["done_t"],
        prefilled=d["prefilled"],
        generated=d["generated"],
    )


def _instance_to_dict(inst: ServingInstance) -> dict[str, Any]:
    return {
        "id": inst.id,
        "model": asdict(inst.model),
        "gpu": asdict(inst.gpu),
        "gpu_count": inst.gpu_count,
        "tp": inst.tp,
        "pp": inst.pp,
        "quant": inst.quant,
        "paged_efficiency": inst.paged_efficiency,
        "last_util": inst.last_util,
        "queue": [asdict(r) for r in inst.queue],
        "running": [asdict(r) for r in inst.running],
    }


def _instance_from_dict(d: dict[str, Any]) -> ServingInstance:
    return ServingInstance(
        id=d["id"],
        model=ModelSpec(**d["model"]),
        gpu=GpuType(**d["gpu"]),
        gpu_count=d["gpu_count"],
        tp=d["tp"],
        pp=d["pp"],
        quant=d["quant"],
        paged_efficiency=d["paged_efficiency"],
        last_util=d.get("last_util", 0.0),  # tolerate snapshots taken before this field existed
        queue=deque(_request_from_dict(r) for r in d["queue"]),
        running=[_request_from_dict(r) for r in d["running"]],
    )


def _workload_to_dict(w: WorkloadConfig) -> dict[str, Any]:
    return {
        "base_rate": w.base_rate,
        "input_dist": asdict(w.input_dist),
        "output_dist": asdict(w.output_dist),
        "rate_points": [list(p) for p in w.rate_points],
    }


def _workload_from_dict(d: dict[str, Any]) -> WorkloadConfig:
    return WorkloadConfig(
        base_rate=d["base_rate"],
        input_dist=LengthDist(**d["input_dist"]),
        output_dist=LengthDist(**d["output_dist"]),
        rate_points=tuple((float(t), float(m)) for t, m in d["rate_points"]),
    )


def state_to_dict(state: ClusterState) -> dict[str, Any]:
    """A JSON-serializable snapshot of the full simulation state, RNG included."""
    return {
        "t": state.t,
        "rng": state.rng.get_state(),
        "instances": [_instance_to_dict(i) for i in state.instances],
        "free_gpus": dict(state.free_gpus),
        "cash": state.cash,
        "power_budget_w": state.power_budget_w,
        "pue": state.pue,
        "slo": asdict(state.slo),
        "workload": _workload_to_dict(state.workload),
        "price_per_token": state.price_per_token,
        "price_per_wh": state.price_per_wh,
        "next_request_id": state.next_request_id,
        "recent_completed": [asdict(r) for r in state.recent_completed],
    }


def state_from_dict(d: dict[str, Any]) -> ClusterState:
    """Reconstruct a ``ClusterState`` from :func:`state_to_dict` output."""
    rng = Rng.from_seed(0)
    rng.set_state(d["rng"])
    return ClusterState(
        t=d["t"],
        rng=rng,
        instances=[_instance_from_dict(i) for i in d["instances"]],
        free_gpus=dict(d["free_gpus"]),
        cash=d["cash"],
        power_budget_w=d["power_budget_w"],
        pue=d["pue"],
        slo=SloConfig(**d["slo"]),
        workload=_workload_from_dict(d["workload"]),
        price_per_token=d["price_per_token"],
        price_per_wh=d["price_per_wh"],
        next_request_id=d["next_request_id"],
        recent_completed=deque(
            (_request_from_dict(r) for r in d["recent_completed"]),
            maxlen=RECENT_COMPLETED_MAXLEN,
        ),
    )


def state_to_json(state: ClusterState) -> str:
    return json.dumps(state_to_dict(state))


def state_from_json(text: str) -> ClusterState:
    obj: dict[str, Any] = json.loads(text)
    return state_from_dict(obj)
