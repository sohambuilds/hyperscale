"""M0/M1 smoke tests: the package imports, the contract types exist, entities construct."""

from collections import deque

from sim_core import SetGpuCount, step
from sim_core.entities import ClusterState, Request
from sim_core.rng import Rng


def test_contract_action() -> None:
    action = SetGpuCount(instance_id="i0", count=4)
    assert action.count == 4
    assert callable(step)


def test_rng_is_seeded_and_deterministic() -> None:
    a = [Rng.from_seed(7).poisson(3.0) for _ in range(5)]
    b = [Rng.from_seed(7).poisson(3.0) for _ in range(5)]
    assert a == b


def test_request_progress_helpers() -> None:
    req = Request(id=0, arrive_t=0.0, input_len=10, target_output_len=5)
    assert not req.prefill_done
    req.prefilled = 10
    req.generated = 2
    assert req.prefill_done
    assert req.live_tokens == 12


def test_cluster_state_fixture(state: ClusterState) -> None:
    assert state.instances[0].gpu.name == "A"
    assert isinstance(state.instances[0].queue, deque)
    assert state.workload.base_rate == 20.0
