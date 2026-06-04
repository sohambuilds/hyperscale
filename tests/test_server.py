"""Server smoke tests over a real WebSocket (via Starlette's TestClient).

Sessions start paused, so we drive them with the manual ``step`` control instead of the wall-
clock timer — no sleeps, no flakiness. This exercises the full ingest→step→broadcast cycle the
browser relies on. Skipped automatically when the ``server`` extra isn't installed."""

import pytest

pytest.importorskip("httpx")  # fastapi.testclient needs httpx

from fastapi.testclient import TestClient  # noqa: E402

from server.app import app  # noqa: E402


def test_healthz_lists_scenarios() -> None:
    client = TestClient(app)
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "ramp" in body["scenarios"]


def test_ws_init_then_manual_step_advances_one_second() -> None:
    client = TestClient(app)
    with client.websocket_connect("/ws?scenario=ramp&seed=1") as ws:
        init = ws.receive_json()
        assert init["type"] == "init"
        assert init["scenario"] == "ramp"
        assert init["paused"] is True
        assert init["observation"]["metrics"]["t"] == 0.0

        ws.send_json({"type": "step"})
        tick = ws.receive_json()
        assert tick["type"] == "tick"
        assert tick["observation"]["metrics"]["t"] == 1.0


def test_ws_init_carries_hardware_fields_and_catalog() -> None:
    """The init frame must carry enough hardware identity for the isometric floor: per-instance
    gpu/parallelism/quant/util/power, plus a static spec catalog of GPU types and models."""
    client = TestClient(app)
    with client.websocket_connect("/ws?scenario=ramp&seed=1") as ws:
        init = ws.receive_json()

        inst = init["observation"]["instances"][0]
        for field in ("gpu_name", "tp", "pp", "quant", "gpu_util", "power_w"):
            assert field in inst, f"InstanceView missing {field!r}"
        assert inst["gpu_util"] == 0.0  # nothing has run on the fresh init frame

        catalog = init["catalog"]
        assert catalog["gpus"] and catalog["models"]
        gpu = catalog["gpus"][0]
        assert gpu["name"] == inst["gpu_name"]
        for field in ("hbm_gb", "hbm_bw_gbs", "peak_flops", "power_w", "cost_per_hour"):
            assert field in gpu, f"GpuTypeView missing {field!r}"
        model = catalog["models"][0]
        assert model["name"] == inst["model_name"]
        assert "num_params" in model and "num_layers" in model


def test_ws_set_gpu_count_takes_effect_on_next_tick() -> None:
    client = TestClient(app)
    with client.websocket_connect("/ws?scenario=ramp&seed=1") as ws:
        init = ws.receive_json()
        start = init["observation"]["instances"][0]["gpu_count"]

        ws.send_json({"type": "set_gpu_count", "instance_id": "serve-0", "count": start + 3})
        ws.send_json({"type": "step"})
        tick = ws.receive_json()
        assert tick["observation"]["instances"][0]["gpu_count"] == start + 3


def test_ws_rejects_invalid_control_message() -> None:
    client = TestClient(app)
    with client.websocket_connect("/ws?scenario=ramp&seed=1") as ws:
        ws.receive_json()  # init
        ws.send_json({"type": "totally-not-a-control"})
        err = ws.receive_json()
        assert err["type"] == "error"


def test_ws_runs_to_completion_and_emits_score() -> None:
    """Drive the whole ramp with manual steps; the final tick is followed by a ``done`` + score.

    This covers the one branch the other smoke tests don't: the end-of-run envelope the
    frontend's Results screen renders.
    """
    client = TestClient(app)
    with client.websocket_connect("/ws?scenario=ramp&seed=1") as ws:
        duration = ws.receive_json()["duration_s"]  # init

        done = None
        guard = 0
        while done is None and guard < 2000:  # safety bound; the ramp is 600 ticks
            guard += 1
            ws.send_json({"type": "step"})
            msg = ws.receive_json()
            if msg["type"] == "done":
                done = msg
            elif msg["type"] == "tick" and msg["observation"]["metrics"]["t"] >= duration:
                done = ws.receive_json()  # finishing tick is immediately followed by `done`

        assert done is not None and done["type"] == "done"
        assert done["observation"]["metrics"]["t"] >= duration
        score = done["score"]
        for field in (
            "profit",
            "mean_slo_attainment",
            "reliability",
            "requests_completed",
            "requests_churned",
            "tokens_served",
        ):
            assert field in score
        assert score["requests_completed"] > 0  # a full ramp must serve real traffic
