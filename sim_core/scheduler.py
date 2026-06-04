"""Continuous-batching scheduler: admit requests from the queue into the running batch while
the KV budget allows, and abandon requests that have waited past their patience.

This is the default M1 scheduler (in-flight / continuous batching). Static batching — the
"you haven't unlocked the good scheduler yet" baseline — and chunked prefill come later.
"""

from __future__ import annotations

from collections import deque

from sim_core.entities import Request, ServingInstance


def footprint(req: Request) -> int:
    """KV-token footprint reserved for a request: input plus its planned output.

    Reserving the planned output up front keeps the live KV from exceeding the ceiling as
    sequences generate (M1 has no mid-flight eviction)."""
    return req.input_len + req.target_output_len


def drop_expired(inst: ServingInstance, t: float, max_wait_s: float) -> int:
    """Abandon queued requests that have waited beyond patience. Returns the count dropped."""
    if max_wait_s <= 0.0 or not inst.queue:
        return 0
    kept: deque[Request] = deque(maxlen=inst.queue.maxlen)
    dropped = 0
    for req in inst.queue:
        if t - req.arrive_t > max_wait_s:
            dropped += 1
        else:
            kept.append(req)
    inst.queue = kept
    return dropped


def admit(inst: ServingInstance, max_tokens: int, t: float) -> None:
    """Pull from the queue into the running batch while the KV budget allows (FIFO)."""
    used = sum(footprint(r) for r in inst.running)
    while inst.queue:
        nxt = inst.queue[0]
        if used + footprint(nxt) > max_tokens:
            break
        inst.queue.popleft()
        nxt.admit_t = t
        inst.running.append(nxt)
        used += footprint(nxt)
