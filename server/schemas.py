"""Inbound wire schemas: the control messages a client sends over the WebSocket.

Pydantic validates and tags them so ``app.py`` can dispatch on a discriminated union and an
unknown/malformed message is rejected at the boundary rather than corrupting the simulation.
Outbound framing (state → JSON) lives in ``ws.py``.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, TypeAdapter


class SetGpuCountMsg(BaseModel):
    """Allocate ``count`` GPUs to a serving instance (clamped to availability by the engine)."""

    type: Literal["set_gpu_count"]
    instance_id: str
    count: int = Field(ge=0)


class StepMsg(BaseModel):
    """Advance exactly one tick now, regardless of pause state (manual stepping / tests)."""

    type: Literal["step"]


class PauseMsg(BaseModel):
    type: Literal["pause"]


class ResumeMsg(BaseModel):
    type: Literal["resume"]


class SetSpeedMsg(BaseModel):
    """Set the real-time tick multiplier (1x / 2x / 4x ...)."""

    type: Literal["set_speed"]
    speed: float = Field(gt=0.0, le=16.0)


ControlMessage = Annotated[
    SetGpuCountMsg | StepMsg | PauseMsg | ResumeMsg | SetSpeedMsg,
    Field(discriminator="type"),
]

_ADAPTER: TypeAdapter[ControlMessage] = TypeAdapter(ControlMessage)


def parse_control(raw: object) -> ControlMessage:
    """Validate a decoded JSON object into a control message (raises on anything unknown)."""
    return _ADAPTER.validate_python(raw)
