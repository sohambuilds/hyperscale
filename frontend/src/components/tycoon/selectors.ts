// Pure, read-only derivations from GameState for UI hints (ghost validity, install blockers,
// heat intensity, meter pressure). ADVISORY ONLY — the engine remains the source of truth and
// re-validates every action (and sets state.message on rejection). The two engine mirrors here
// (techPowerMult, installHint) intentionally replicate the guards in engine.installGpu /
// engine.techMults — if those change, change these.

import {
  COOLING_TIERS,
  GPU_TIERS,
  PLACEABLES,
  POWER_TIERS,
  RACK_SLOTS,
  TECHS,
} from "../../game/config";
import type { GameState, Placed, PlaceableKind, Stats, TechId } from "../../game/types";

export function tileOccupant(s: GameState, col: number, row: number): Placed | undefined {
  return s.placed.find((p) => p.col === col && p.row === row);
}

export interface PlaceCheck {
  ok: boolean;
  reason: "occupied" | "cash" | null;
  cost: number;
}

export function placeValidity(s: GameState, kind: PlaceableKind, col: number, row: number): PlaceCheck {
  const cost = PLACEABLES[kind].capex;
  if (tileOccupant(s, col, row)) return { ok: false, reason: "occupied", cost };
  if (s.cash < cost) return { ok: false, reason: "cash", cost };
  return { ok: true, reason: null, cost };
}

/** Mirrors the power factor of engine.techMults() (capMult does not affect power). */
export function techPowerMult(unlocked: TechId[]): number {
  let power = 1;
  for (const id of unlocked) {
    const t = TECHS.find((x) => x.id === id);
    if (t?.fx.powerMult) power *= t.fx.powerMult;
  }
  return power;
}

export function facilityCaps(s: GameState): { powerCap: number; coolCap: number } {
  let powerCap = 0;
  let coolCap = 0;
  for (const p of s.placed) {
    if (p.kind === "power") powerCap += POWER_TIERS[p.tier ?? 0].kw;
    else if (p.kind === "cooling") coolCap += COOLING_TIERS[p.tier ?? 0].kw;
  }
  return { powerCap, coolCap };
}

/** Total kW the installed fleet WANTS (before the engine's online-fraction haircut). */
export function totalDrawKw(s: GameState): number {
  const mult = techPowerMult(s.unlocked);
  let draw = 0;
  for (const p of s.placed) {
    if (p.kind === "rack") draw += (p.gpus ?? 0) * GPU_TIERS[p.gpuType ?? "h100"].drawKw * mult;
  }
  return draw;
}

export type InstallBlock = "full" | "cash" | "power" | "cooling" | null;

/** Mirrors engine.installGpu's guards so the Install button can explain itself BEFORE the click. */
export function installHint(s: GameState, rackId: string): { ok: boolean; reason: InstallBlock } {
  const rack = s.placed.find((p) => p.id === rackId && p.kind === "rack");
  if (!rack) return { ok: false, reason: null };
  if ((rack.gpus ?? 0) >= RACK_SLOTS) return { ok: false, reason: "full" };
  const t = GPU_TIERS[rack.gpuType ?? "h100"];
  if (s.cash < t.capex) return { ok: false, reason: "cash" };
  const { powerCap, coolCap } = facilityCaps(s);
  const draw = totalDrawKw(s) + t.drawKw * techPowerMult(s.unlocked);
  if (draw > powerCap) return { ok: false, reason: "power" };
  if (draw > coolCap) return { ok: false, reason: "cooling" };
  return { ok: true, reason: null };
}

/** Fraction of installed GPUs the engine can actually run (power/cooling haircut). */
export function fracOnline(stats: Stats): number {
  return stats.gpus > 0 ? stats.gpusOnline / stats.gpus : 1;
}

/** 0..1 heat intensity for a rack's floor glow (≈ a full B200 rack at 1.0). */
export function rackLoad(p: Placed, powerMult: number, online: number): number {
  if (p.kind !== "rack") return 0;
  const draw = (p.gpus ?? 0) * GPU_TIERS[p.gpuType ?? "h100"].drawKw * powerMult * online;
  return Math.max(0, Math.min(1, draw / 5));
}

export function contractCounts(s: GameState): { onTrack: number; atRisk: number; breaching: number } {
  let onTrack = 0;
  let atRisk = 0;
  let breaching = 0;
  for (const c of s.contracts) {
    if (c.status === "on-track") onTrack++;
    else if (c.status === "at-risk") atRisk++;
    else breaching++;
  }
  return { onTrack, atRisk, breaching };
}

export function anyBreaching(s: GameState): boolean {
  return s.contracts.some((c) => c.status === "breaching");
}
