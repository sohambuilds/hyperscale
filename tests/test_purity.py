"""The architectural guardrail: ``sim_core`` must stay a pure library. Importing it may not
drag in any web framework or async runtime, and it must work with only numpy installed. If this
test ever fails, the server/UI/RL layers have started leaking into the core — the one thing the
whole design depends on not happening.

Checked in a fresh subprocess so that frameworks imported by *other* test modules in this
process can't produce a false positive."""

import subprocess
import sys

FORBIDDEN = (
    "fastapi",
    "uvicorn",
    "starlette",
    "pydantic",
    "websockets",
    "asyncio",
    "aiohttp",
    "requests",
)

_PROBE = """
import importlib, json, sys

modules = [
    "sim_core",
    "sim_core.engine",
    "sim_core.entities",
    "sim_core.types",
    "sim_core.rng",
    "sim_core.physics",
    "sim_core.scheduler",
    "sim_core.economics",
    "sim_core.workload",
    "sim_core.serialization",
]
for name in modules:
    importlib.import_module(name)
print(json.dumps(sorted(sys.modules)))
"""


def test_importing_sim_core_pulls_in_no_framework() -> None:
    proc = subprocess.run(
        [sys.executable, "-c", _PROBE],
        capture_output=True,
        text=True,
        check=True,
    )
    import json

    loaded = set(json.loads(proc.stdout))
    leaked = sorted(m for m in FORBIDDEN if m in loaded)
    assert not leaked, f"sim_core import leaked framework/async modules: {leaked}"
