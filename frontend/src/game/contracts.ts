// Contract offers + demand evolution. Baseline contracts are steady (mild noise); burst
// contracts sit low and occasionally spike — that volatility is what makes capacity planning
// a live decision instead of a one-time solve.

import { ARCHETYPES, type Archetype } from "./config";
import type { Contract, Offer } from "./types";

let _id = 1;
export const genId = (prefix: string): string => `${prefix}-${_id++}`;
/** Advance the id counter past a loaded save so new ids never collide with restored ones. */
export const bumpId = (n: number): void => {
  _id = Math.max(_id, n + 1);
};

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Roll a new offer the player hasn't already taken/seen, gated by reputation. Null if none. */
export function rollOffer(reputation: number, takenNames: Set<string>): Offer | null {
  const eligible = ARCHETYPES.filter(
    (a) => a.minReputation <= reputation && !takenNames.has(a.name),
  );
  if (!eligible.length) return null;
  const a: Archetype = pick(eligible);
  return {
    id: genId("offer"),
    name: a.name,
    kind: a.kind,
    strict: a.strict,
    quality: a.quality,
    baseDemand: a.baseDemand,
    price: a.price,
    penalty: a.penalty,
  };
}

/** Roll an offer for a specific archetype name (used to seed the opening hand). */
export function offerNamed(name: string): Offer | null {
  const a = ARCHETYPES.find((x) => x.name === name);
  if (!a) return null;
  return {
    id: genId("offer"),
    name: a.name,
    kind: a.kind,
    strict: a.strict,
    quality: a.quality,
    baseDemand: a.baseDemand,
    price: a.price,
    penalty: a.penalty,
  };
}

/** Turn an accepted offer into a live contract. */
export function activate(offer: Offer): Contract {
  return {
    id: genId("c"),
    name: offer.name,
    kind: offer.kind,
    strict: offer.strict,
    quality: offer.quality,
    baseDemand: offer.baseDemand,
    price: offer.price,
    penalty: offer.penalty,
    demand: offer.kind === "burst" ? offer.baseDemand * 0.3 : offer.baseDemand,
    served: 0,
    health: 1,
    status: "on-track",
    burstT: 0,
    breachT: 0,
  };
}

/** Next demand value + burst timer for a contract this tick. */
export function nextDemand(c: Contract): { demand: number; burstT: number } {
  if (c.kind === "burst") {
    let burstT = c.burstT;
    if (burstT > 0) {
      burstT -= 1;
      const mult = 2 + Math.random(); // 2–3× during a burst
      return { demand: c.baseDemand * mult, burstT };
    }
    // chance to kick off a new burst
    if (Math.random() < 0.04) burstT = 12 + Math.floor(Math.random() * 18);
    const idle = c.baseDemand * (0.25 + Math.random() * 0.15);
    return { demand: idle, burstT };
  }
  // baseline: steady with ±12% noise
  const noise = 1 + (Math.random() - 0.5) * 0.24;
  return { demand: c.baseDemand * noise, burstT: 0 };
}
