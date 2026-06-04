"""FastAPI app: one WebSocket per play session, driven by a single coroutine.

The driver loop is the whole real-time design: it ``await``s the next client message with a
timeout equal to the current tick interval. A message arriving first is applied as a control;
the timeout firing first advances the simulation one tick. Doing both in one coroutine means we
never send from two tasks at once, and pausing is just "await with no timeout". Run locally with:

    uv run uvicorn server.app:app --reload
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from server.schemas import parse_control
from server.session import Session, scenario_names
from server.ws import done_payload, init_payload, tick_payload
from sim_core.engine import TICK_SECONDS

app = FastAPI(title="INFERENCE — sim server")

# Permissive CORS so the Vite dev server (localhost:5173) can reach the API in development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"status": "ok", "scenarios": scenario_names(), "tick_seconds": TICK_SECONDS}


async def _advance_and_send(websocket: WebSocket, session: Session) -> None:
    """Advance one tick, stream it, and emit the final score once the clock runs out."""
    observation = session.advance()
    await websocket.send_json(tick_payload(observation))
    if session.finished and not session.done_emitted:
        session.done_emitted = True
        await websocket.send_json(done_payload(observation, session.score()))


async def _drive(websocket: WebSocket, session: Session) -> None:
    while True:
        # No timeout while paused or finished: block until the player does something.
        timeout = None if (session.paused or session.finished) else session.tick_interval()
        try:
            raw = await asyncio.wait_for(websocket.receive_json(), timeout=timeout)
        except TimeoutError:
            await _advance_and_send(websocket, session)  # the tick deadline won
            continue
        except WebSocketDisconnect:
            return

        try:
            message = parse_control(raw)
        except ValidationError:
            await websocket.send_json({"type": "error", "error": "invalid control message"})
            continue

        if session.apply_control(message):  # a manual "step" advances immediately
            await _advance_and_send(websocket, session)


@app.websocket("/ws")
async def game(websocket: WebSocket, scenario: str = "ramp", seed: int = 1) -> None:
    await websocket.accept()
    try:
        session = Session.create(scenario, seed)
    except KeyError:
        await websocket.send_json({"type": "error", "error": f"unknown scenario {scenario!r}"})
        await websocket.close(code=1008)
        return

    await websocket.send_json(
        init_payload(
            scenario=session.scenario,
            seed=session.seed,
            tick_seconds=TICK_SECONDS,
            duration_s=session.duration_s,
            speed=session.speed,
            paused=session.paused,
            observation=session.current_observation(),
            catalog=session.catalog(),
        )
    )
    await _drive(websocket, session)
