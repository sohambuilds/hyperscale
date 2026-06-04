"""The money and power model (design §3.4).

GPUs cost rent (or amortized capex) and draw power; power is multiplied by PUE (cooling /
facility overhead) and priced per watt-hour. Idle GPUs still burn — over-provisioning is as
much a failure as under-provisioning.
"""

from __future__ import annotations

from sim_core.entities import ServingInstance

IDLE_POWER_FRAC: float = 0.3  # a GPU at 0% utilization still draws ~30% of its load power


def instance_power_w(inst: ServingInstance, util: float) -> float:
    """Power draw (W) of an instance at the given utilization (0..1)."""
    factor = IDLE_POWER_FRAC + (1.0 - IDLE_POWER_FRAC) * max(0.0, min(1.0, util))
    return inst.gpu_count * inst.gpu.power_w * factor


def gpu_rental_cost(inst: ServingInstance, dt_s: float) -> float:
    """GPU rental/amortized cost ($) for this tick."""
    return inst.gpu_count * inst.gpu.cost_per_hour * (dt_s / 3600.0)


def energy_cost(power_w: float, pue: float, price_per_wh: float, dt_s: float) -> float:
    """Electricity cost ($) for this tick, including PUE overhead."""
    energy_wh = power_w * pue * (dt_s / 3600.0)
    return energy_wh * price_per_wh
