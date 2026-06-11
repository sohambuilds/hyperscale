// Operator Level — the player-facing presentation of reputation. Reputation stays the single
// source of truth in GameState (every minRep gate keeps reading it); this module only maps it
// to a level number, ring progress, and "what unlocks at level N" copy for the level-up
// ceremony. Thresholds are aligned with the minRep values used across config.ts so each
// level-up lands at least one real unlock.

import {
  ARCHETYPES,
  COOLING_TIERS,
  GPU_TIERS,
  GPU_TIER_ORDER,
  POWER_TIERS,
} from "./config";

/** Reputation needed to REACH level index+1 (level 1 = rep 0). */
export const LEVEL_REPS: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export const MAX_LEVEL = LEVEL_REPS.length; // 9

export function levelFromRep(rep: number): number {
  let lvl = 1;
  for (let i = 1; i < LEVEL_REPS.length; i++) {
    if (rep >= LEVEL_REPS[i]) lvl = i + 1;
  }
  return lvl;
}

/** Progress 0..1 toward the next level (1 when maxed). */
export function levelProgress(rep: number): number {
  const lvl = levelFromRep(rep);
  if (lvl >= MAX_LEVEL) return 1;
  const cur = LEVEL_REPS[lvl - 1];
  const next = LEVEL_REPS[lvl];
  return Math.max(0, Math.min(1, (rep - cur) / (next - cur)));
}

/** The reputation value a given level corresponds to (for matching minRep gates). */
export function repAtLevel(level: number): number {
  return LEVEL_REPS[Math.max(0, Math.min(MAX_LEVEL - 1, level - 1))];
}

/** Human list of everything that unlocks exactly at `level` — shown in the level-up ceremony. */
export function unlocksAtLevel(level: number): string[] {
  const rep = repAtLevel(level);
  const prevRep = repAtLevel(level - 1);
  const inWindow = (minRep: number): boolean => minRep > prevRep && minRep <= rep;

  const out: string[] = [];
  for (const id of GPU_TIER_ORDER) {
    const t = GPU_TIERS[id];
    if (inWindow(t.minRep)) out.push(`${t.name} GPU servers`);
  }
  for (const p of POWER_TIERS) if (inWindow(p.minRep)) out.push(`${p.name} (power upgrade)`);
  for (const c of COOLING_TIERS) if (inWindow(c.minRep)) out.push(`${c.name} (cooling upgrade)`);
  for (const a of ARCHETYPES) if (inWindow(a.minReputation)) out.push(`"${a.name}" contracts`);
  return out;
}
