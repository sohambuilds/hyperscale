// The economy engine: pure functions over GameState. computeStats() derives capacities + money
// (GPU tiers, cooling-derived PUE, research multipliers); tick() advances demand, serves it,
// updates cash, contract health, run stats, win/lose, and floating feedback.

import {
  BANKRUPT_FLOOR,
  BANKRUPT_GRACE,
  BASE_BUILDERS,
  BASE_NET_CAP,
  BUILD_MS,
  CHURN_AFTER,
  COOLING_TIERS,
  CREWPOD,
  DEFAULT_GPU_TIER,
  DEFAULT_PUE,
  ELEC_PER_KWH,
  GOAL_CASH,
  GPU_TIERS,
  GRID_COLS,
  GRID_ROWS,
  MAX_OFFERS,
  NETWORK_TIERS,
  OFFER_INTERVAL,
  POWER_TIERS,
  RACK_CAPEX,
  RACK_RENT_PER_MIN,
  RACK_SLOTS,
  REP_PER_TICK_ON_TRACK,
  SELL_REFUND,
  START_CASH,
  TECHS,
  type TechSpec,
} from "./config";
import { activate, genId, nextDemand, offerNamed, rollOffer } from "./contracts";
import { detectDone, questById, updateQuestProg } from "./quests";
import type {
  Contract,
  FxItem,
  GameState,
  GameStatus,
  GpuTierId,
  Placed,
  PlaceableKind,
  Policy,
  Stats,
  TechId,
} from "./types";

export function emptyState(): GameState {
  const offers = [offerNamed("Chatbot backfill"), offerNamed("Realtime assistant")].filter(
    (o): o is NonNullable<typeof o> => o != null,
  );
  return {
    cash: START_CASH,
    tick: 0,
    paused: true,
    speed: 1,
    placed: [],
    contracts: [],
    offers,
    selectedId: null,
    tool: "cursor",
    reputation: 0,
    unlocked: [],
    status: "playing",
    bankruptT: 0,
    muted: false,
    totalEarned: 0,
    servedTotal: 0,
    peakReputation: 0,
    peakCash: START_CASH,
    questDone: [],
    questClaimed: [],
    questProg: {},
    message: "Build Power → Cooling → a Rack, install GPUs, then sign a contract.",
    nextOfferAt: OFFER_INTERVAL,
    fx: [],
    fxSeq: 1,
  };
}

export const inBounds = (col: number, row: number): boolean =>
  col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;

const occupied = (s: GameState, col: number, row: number): boolean =>
  s.placed.some((p) => p.col === col && p.row === row);

const gpuTier = (id: GpuTierId | undefined) => GPU_TIERS[id ?? DEFAULT_GPU_TIER];

/** A placeable is operational once its construction finishes (buildMs spent). */
export const isBuilt = (p: Placed): boolean => !(p.buildMs != null && p.buildMs > 0);

const baseCapex = (kind: PlaceableKind): number =>
  kind === "power"
    ? POWER_TIERS[0].capex
    : kind === "cooling"
      ? COOLING_TIERS[0].capex
      : kind === "network"
        ? NETWORK_TIERS[0].capex
        : kind === "crewpod"
          ? CREWPOD.capex
          : RACK_CAPEX;
const LABELS: Record<PlaceableKind, string> = {
  power: "Power unit",
  cooling: "Cooling unit",
  rack: "Rack",
  network: "Network switch",
  crewpod: "Crew pod",
};

interface Mults {
  thru: number;
  lat: number;
  power: number;
  qrev: number;
}
function techMults(unlocked: TechId[]): Mults {
  let thru = 1;
  let lat = 1;
  let power = 1;
  let qrev = 1;
  for (const id of unlocked) {
    const t = TECHS.find((x) => x.id === id);
    if (!t) continue;
    const cap = t.fx.capMult ?? 1;
    thru *= (t.fx.thruMult ?? 1) * cap;
    lat *= (t.fx.latMult ?? 1) * cap;
    power *= t.fx.powerMult ?? 1;
    qrev *= t.fx.qualityRevMult ?? 1;
  }
  return { thru, lat, power, qrev };
}

function facility(s: GameState): { powerCap: number; coolCap: number; pue: number; netCap: number } {
  let powerCap = 0;
  let coolCap = 0;
  let pue = DEFAULT_PUE;
  let netCap = BASE_NET_CAP;
  for (const p of s.placed) {
    if (!isBuilt(p)) continue; // under-construction gear isn't online yet
    if (p.kind === "power") powerCap += POWER_TIERS[p.tier ?? 0].kw;
    else if (p.kind === "cooling") {
      const c = COOLING_TIERS[p.tier ?? 0];
      coolCap += c.kw;
      pue = Math.min(pue, c.pue); // best cooling sets the facility PUE
    } else if (p.kind === "network") netCap += NETWORK_TIERS[p.tier ?? 0].cap;
  }
  return { powerCap, coolCap, pue, netCap };
}

/** Build crew: BASE plus one per operational crew pod. */
export function builderInfo(s: GameState): { total: number; busy: number; free: number } {
  const total = BASE_BUILDERS + s.placed.filter((p) => p.kind === "crewpod" && isBuilt(p)).length;
  const busy = Math.min(total, s.placed.filter((p) => !isBuilt(p)).length);
  return { total, busy, free: total - busy };
}

export function computeStats(s: GameState): Stats {
  const m = techMults(s.unlocked);
  const { powerCap, coolCap, pue, netCap } = facility(s);

  let installed = 0;
  let totalDraw = 0;
  let latInstalled = 0;
  let thruInstalled = 0;
  for (const p of s.placed) {
    if (p.kind !== "rack" || !isBuilt(p)) continue;
    const g = p.gpus ?? 0;
    if (g <= 0) continue;
    const t = gpuTier(p.gpuType);
    installed += g;
    totalDraw += g * t.drawKw * m.power;
    if ((p.policy ?? "throughput") === "latency") latInstalled += g * t.latRps;
    else thruInstalled += g * t.thruRps;
  }
  const totalHeat = totalDraw; // heat ≈ power draw
  const fracPower = totalDraw > 0 ? powerCap / totalDraw : 1;
  const fracCool = totalHeat > 0 ? coolCap / totalHeat : 1;
  const fracOnline = Math.min(1, fracPower, fracCool);
  const online = Math.floor(installed * fracOnline + 1e-9);
  const latencyCap = latInstalled * fracOnline * m.lat;
  const throughputCap = thruInstalled * fracOnline * m.thru;
  const powerUsed = totalDraw * fracOnline;
  const coolUsed = totalHeat * fracOnline;

  let strictDemand = 0;
  let looseDemand = 0;
  for (const c of s.contracts) {
    if (c.strict) strictDemand += c.demand;
    else looseDemand += c.demand;
  }
  // network uplink clamps total served (strict-first), on top of the compute pools
  const servedStrict = Math.min(strictDemand, latencyCap, netCap);
  const leftoverLat = Math.max(0, latencyCap - servedStrict);
  const servedLoose = Math.min(looseDemand, throughputCap + leftoverLat, Math.max(0, netCap - servedStrict));

  const strictShare = strictDemand > 0 ? servedStrict / strictDemand : 1;
  const looseShare = looseDemand > 0 ? servedLoose / looseDemand : 1;
  let revPerSec = 0;
  let penaltyPerSec = 0;
  for (const c of s.contracts) {
    const share = c.strict ? strictShare : looseShare;
    const cs = c.demand * share;
    const price = c.quality ? c.price * m.qrev : c.price;
    revPerSec += cs * price;
    if (c.strict) penaltyPerSec += (c.demand - cs) * c.penalty;
  }

  // only operational gear pays rent (you don't pay for what's still being built)
  let rentPerMin = 0;
  for (const p of s.placed) {
    if (!isBuilt(p)) continue;
    if (p.kind === "power") rentPerMin += POWER_TIERS[p.tier ?? 0].rentPerMin;
    else if (p.kind === "cooling") rentPerMin += COOLING_TIERS[p.tier ?? 0].rentPerMin;
    else if (p.kind === "network") rentPerMin += NETWORK_TIERS[p.tier ?? 0].rentPerMin;
    else if (p.kind === "crewpod") rentPerMin += CREWPOD.rentPerMin;
    else rentPerMin += RACK_RENT_PER_MIN + (p.gpus ?? 0) * gpuTier(p.gpuType).rentPerMin;
  }
  const rentPerSec = rentPerMin / 60;
  const elecPerSec = (powerUsed * pue * ELEC_PER_KWH) / 3600;
  const profitPerSec = revPerSec - rentPerSec - elecPerSec - penaltyPerSec;

  return {
    powerCap,
    powerUsed,
    coolCap,
    coolUsed,
    pue,
    latencyCap,
    throughputCap,
    netCap,
    gpus: installed,
    gpusOnline: online,
    demand: strictDemand + looseDemand,
    served: servedStrict + servedLoose,
    breached: Math.max(0, strictDemand - servedStrict),
    revPerSec,
    rentPerSec,
    elecPerSec,
    penaltyPerSec,
    profitPerSec,
  };
}

function statusFor(strict: boolean, health: number): Contract["status"] {
  if (strict) return health >= 0.95 ? "on-track" : health >= 0.8 ? "at-risk" : "breaching";
  return health >= 0.85 ? "on-track" : health >= 0.6 ? "at-risk" : "breaching";
}

export function tick(s: GameState, dt = 1): GameState {
  if (s.status !== "playing") return s;

  const contracts = s.contracts.map((c) => {
    const { demand, burstT } = nextDemand(c);
    return { ...c, demand, burstT };
  });
  const stats = computeStats({ ...s, contracts });

  let strictDemand = 0;
  let looseDemand = 0;
  for (const c of contracts) {
    if (c.strict) strictDemand += c.demand;
    else looseDemand += c.demand;
  }
  const servedStrict = Math.min(strictDemand, stats.latencyCap);
  const leftoverLat = Math.max(0, stats.latencyCap - servedStrict);
  const servedLoose = Math.min(looseDemand, stats.throughputCap + leftoverLat);
  const strictShare = strictDemand > 0 ? servedStrict / strictDemand : 1;
  const looseShare = looseDemand > 0 ? servedLoose / looseDemand : 1;

  let reputation = s.reputation;
  let message = s.message;
  const survivors: Contract[] = [];
  for (const c of contracts) {
    const share = c.strict ? strictShare : looseShare;
    const served = c.demand * share;
    const frac = c.demand > 0 ? share : 1;
    const health = c.health * 0.85 + frac * 0.15;
    const status = statusFor(c.strict, health);
    const breachT = status === "breaching" ? c.breachT + 1 : Math.max(0, c.breachT - 2);
    if (status === "on-track") reputation += REP_PER_TICK_ON_TRACK * dt;
    if (breachT >= CHURN_AFTER) {
      reputation = Math.max(0, reputation - 0.5);
      message = `Lost contract: ${c.name} — kept breaching its SLA.`;
      continue;
    }
    survivors.push({ ...c, served, health, status, breachT });
  }

  const cash = s.cash + stats.profitPerSec * dt;
  const tickN = s.tick + dt;

  let offers = s.offers;
  let nextOfferAt = s.nextOfferAt;
  if (tickN >= nextOfferAt && offers.length < MAX_OFFERS) {
    const taken = new Set<string>([...survivors.map((c) => c.name), ...offers.map((o) => o.name)]);
    const offer = rollOffer(reputation, taken);
    if (offer) offers = [...offers, offer];
    nextOfferAt = tickN + OFFER_INTERVAL;
  }

  let fxSeq = s.fxSeq;
  const fx: FxItem[] = [];
  const runningRack = s.placed.find((p) => p.kind === "rack" && (p.gpus ?? 0) > 0);
  if (runningRack && stats.profitPerSec > 0.01 && tickN % 2 === 0) {
    fx.push({ id: fxSeq++, rackId: runningRack.id, text: `+$${Math.round(stats.revPerSec)}`, kind: "cash" });
  }
  if (stats.breached > 1) {
    const r = s.placed.find((p) => p.kind === "rack");
    if (r) fx.push({ id: fxSeq++, rackId: r.id, text: "SLA!", kind: "breach" });
  }

  let status: GameStatus = s.status;
  const bankruptT = cash < BANKRUPT_FLOOR ? s.bankruptT + 1 : 0;
  if (bankruptT >= BANKRUPT_GRACE) {
    status = "lost";
    message = "Bankrupt — the cluster went dark.";
  } else if (cash >= GOAL_CASH) {
    status = "won";
    message = "Goal reached — you built a profitable hyperscaler!";
  }

  const next: GameState = {
    ...s,
    cash,
    tick: tickN,
    contracts: survivors,
    offers,
    reputation,
    message,
    nextOfferAt,
    status,
    bankruptT,
    totalEarned: s.totalEarned + Math.max(0, stats.revPerSec) * dt,
    servedTotal: s.servedTotal + stats.served * dt,
    peakReputation: Math.max(s.peakReputation, reputation),
    peakCash: Math.max(s.peakCash, cash),
    fx,
    fxSeq,
  };

  // quests: refresh counters, then latch any newly completed goals
  next.questProg = updateQuestProg(next, stats);
  const newlyDone = detectDone(next);
  if (newlyDone.length) {
    next.questDone = [...next.questDone, ...newlyDone];
    const first = questById(newlyDone[0]);
    if (first) next.message = `Goal complete: ${first.title} — claim your reward in Quests.`;
  }
  return next;
}

/** Latch quest completions outside the tick loop (so building while paused still completes goals). */
export function latchQuests(s: GameState): GameState {
  const newlyDone = detectDone(s);
  if (!newlyDone.length) return s;
  const first = questById(newlyDone[0]);
  return {
    ...s,
    questDone: [...s.questDone, ...newlyDone],
    message: first ? `Goal complete: ${first.title} — claim your reward in Quests.` : s.message,
  };
}

/** Collect a completed quest's reward (cash + reputation). */
export function claimQuest(s: GameState, questId: string): GameState {
  const q = questById(questId);
  if (!q || !s.questDone.includes(questId) || s.questClaimed.includes(questId)) return s;
  const reputation = s.reputation + q.reward.rep;
  return {
    ...s,
    cash: s.cash + q.reward.cash,
    reputation,
    peakReputation: Math.max(s.peakReputation, reputation),
    questClaimed: [...s.questClaimed, questId],
    message: null,
  };
}

// --- action helpers -------------------------------------------------------------------------

export function place(s: GameState, kind: PlaceableKind, col: number, row: number): GameState {
  if (!inBounds(col, row)) return s;
  if (occupied(s, col, row)) return { ...s, message: "That tile is occupied." };
  const capex = baseCapex(kind);
  if (s.cash < capex) return { ...s, message: `Not enough cash for a ${LABELS[kind]}.` };
  const placed = [
    ...s.placed,
    {
      id: genId("p"),
      kind,
      col,
      row,
      tier: 0,
      bornAt: s.tick,
      buildMs: BUILD_MS[kind], // starts under construction — a builder erects it
      ...(kind === "rack" ? { gpus: 0, policy: "throughput" as Policy, gpuType: DEFAULT_GPU_TIER } : {}),
    },
  ];
  return latchQuests({ ...s, placed, cash: s.cash - capex, message: null });
}

export function sellAt(s: GameState, id: string): GameState {
  const item = s.placed.find((p) => p.id === id);
  if (!item) return s;
  const capex =
    item.kind === "power"
      ? POWER_TIERS[item.tier ?? 0].capex
      : item.kind === "cooling"
        ? COOLING_TIERS[item.tier ?? 0].capex
        : item.kind === "network"
          ? NETWORK_TIERS[item.tier ?? 0].capex
          : item.kind === "crewpod"
            ? CREWPOD.capex
            : RACK_CAPEX;
  let refund = capex * SELL_REFUND;
  if (item.kind === "rack") refund += (item.gpus ?? 0) * gpuTier(item.gpuType).capex * SELL_REFUND;
  return {
    ...s,
    placed: s.placed.filter((p) => p.id !== id),
    cash: s.cash + refund,
    selectedId: s.selectedId === id ? null : s.selectedId,
    message: null,
  };
}

export function installGpu(s: GameState, rackId: string): GameState {
  const rack = s.placed.find((p) => p.id === rackId && p.kind === "rack");
  if (!rack) return s;
  if (!isBuilt(rack)) return { ...s, message: "The rack is still under construction." };
  if ((rack.gpus ?? 0) >= RACK_SLOTS) return { ...s, message: "Rack is full (4 slots)." };
  const t = gpuTier(rack.gpuType);
  if (s.cash < t.capex) return { ...s, message: `Not enough cash for a ${t.name} server.` };
  const powerMult = techMults(s.unlocked).power;
  const { powerCap, coolCap } = facility(s);
  let curDraw = 0;
  for (const p of s.placed) {
    if (p.kind === "rack") curDraw += (p.gpus ?? 0) * gpuTier(p.gpuType).drawKw * powerMult;
  }
  const draw = t.drawKw * powerMult;
  if (curDraw + draw > powerCap) return { ...s, message: "Not enough power — build or upgrade Power." };
  if (curDraw + draw > coolCap) return { ...s, message: "Not enough cooling — build or upgrade Cooling." };
  const placed = s.placed.map((p) => (p.id === rackId ? { ...p, gpus: (p.gpus ?? 0) + 1 } : p));
  return latchQuests({ ...s, placed, cash: s.cash - t.capex, message: null });
}

export function removeGpu(s: GameState, rackId: string): GameState {
  const rack = s.placed.find((p) => p.id === rackId && p.kind === "rack");
  if (!rack || (rack.gpus ?? 0) <= 0) return s;
  const refund = gpuTier(rack.gpuType).capex * SELL_REFUND;
  const placed = s.placed.map((p) => (p.id === rackId ? { ...p, gpus: (p.gpus ?? 0) - 1 } : p));
  return { ...s, placed, cash: s.cash + refund, message: null };
}

export function setPolicy(s: GameState, rackId: string, policy: Policy): GameState {
  const placed = s.placed.map((p) => (p.id === rackId ? { ...p, policy } : p));
  return { ...s, placed };
}

export function setGpuType(s: GameState, rackId: string, gpuType: GpuTierId): GameState {
  const rack = s.placed.find((p) => p.id === rackId && p.kind === "rack");
  if (!rack) return s;
  if ((rack.gpus ?? 0) > 0) return { ...s, message: "Empty the rack before switching GPU tier." };
  if (s.reputation < GPU_TIERS[gpuType].minRep)
    return { ...s, message: `${GPU_TIERS[gpuType].name} unlocks at reputation ${GPU_TIERS[gpuType].minRep}.` };
  const placed = s.placed.map((p) => (p.id === rackId ? { ...p, gpuType } : p));
  return { ...s, placed, message: null };
}

export function upgradePower(s: GameState, id: string): GameState {
  const item = s.placed.find((p) => p.id === id && p.kind === "power");
  if (!item || (item.tier ?? 0) >= POWER_TIERS.length - 1) return s;
  const next = POWER_TIERS[(item.tier ?? 0) + 1];
  if (s.reputation < next.minRep) return { ...s, message: `${next.name} unlocks at reputation ${next.minRep}.` };
  const cost = next.capex - POWER_TIERS[item.tier ?? 0].capex;
  if (s.cash < cost) return { ...s, message: `Need ${cost} to upgrade power.` };
  const placed = s.placed.map((p) => (p.id === id ? { ...p, tier: (p.tier ?? 0) + 1 } : p));
  return { ...s, placed, cash: s.cash - cost, message: `Upgraded to ${next.name}.` };
}

export function upgradeCooling(s: GameState, id: string): GameState {
  const item = s.placed.find((p) => p.id === id && p.kind === "cooling");
  if (!item || (item.tier ?? 0) >= COOLING_TIERS.length - 1) return s;
  const next = COOLING_TIERS[(item.tier ?? 0) + 1];
  if (s.reputation < next.minRep) return { ...s, message: `${next.name} unlocks at reputation ${next.minRep}.` };
  const cost = next.capex - COOLING_TIERS[item.tier ?? 0].capex;
  if (s.cash < cost) return { ...s, message: `Need ${cost} to upgrade cooling.` };
  const placed = s.placed.map((p) => (p.id === id ? { ...p, tier: (p.tier ?? 0) + 1 } : p));
  return { ...s, placed, cash: s.cash - cost, message: `Upgraded to ${next.name}.` };
}

export function upgradeNetwork(s: GameState, id: string): GameState {
  const item = s.placed.find((p) => p.id === id && p.kind === "network");
  if (!item || (item.tier ?? 0) >= NETWORK_TIERS.length - 1) return s;
  const next = NETWORK_TIERS[(item.tier ?? 0) + 1];
  if (s.reputation < next.minRep) return { ...s, message: `${next.name} unlocks at reputation ${next.minRep}.` };
  const cost = next.capex - NETWORK_TIERS[item.tier ?? 0].capex;
  if (s.cash < cost) return { ...s, message: `Need ${cost} to upgrade network.` };
  const placed = s.placed.map((p) => (p.id === id ? { ...p, tier: (p.tier ?? 0) + 1 } : p));
  return { ...s, placed, cash: s.cash - cost, message: `Upgraded to ${next.name}.` };
}

/**
 * Advance construction by `dtMs` of wall-clock time. Runs even while the game is paused (builders
 * keep working while you plan), so it's driven on its own interval, not the economic tick. Each
 * builder works one under-construction job; extras queue. Returns the same object if nothing
 * changed so React can bail on the render.
 */
export function advanceBuilders(s: GameState, dtMs: number): GameState {
  const jobs = s.placed.filter((p) => !isBuilt(p));
  if (jobs.length === 0) return s;
  const builders = BASE_BUILDERS + s.placed.filter((p) => p.kind === "crewpod" && isBuilt(p)).length;
  const working = new Set(jobs.slice(0, builders).map((p) => p.id)); // oldest jobs first
  let finished: Placed | null = null;
  const placed = s.placed.map((p) => {
    if (!working.has(p.id)) return p;
    const rem = (p.buildMs ?? 0) - dtMs;
    if (rem <= 0) {
      finished = p;
      const { buildMs: _drop, ...done } = p;
      void _drop;
      return done;
    }
    return { ...p, buildMs: rem };
  });
  const next: GameState = { ...s, placed };
  if (finished) {
    next.message = `${LABELS[(finished as Placed).kind]} online.`;
    return latchQuests(next);
  }
  return next;
}

export function acceptOffer(s: GameState, offerId: string): GameState {
  const offer = s.offers.find((o) => o.id === offerId);
  if (!offer) return s;
  return latchQuests({
    ...s,
    offers: s.offers.filter((o) => o.id !== offerId),
    contracts: [...s.contracts, activate(offer)],
    message: `Signed: ${offer.name}.`,
  });
}

export function declineOffer(s: GameState, offerId: string): GameState {
  return { ...s, offers: s.offers.filter((o) => o.id !== offerId) };
}

/** Why a tech can't be researched yet (null = it can). */
export function techLock(s: GameState, t: TechSpec): string | null {
  if (s.unlocked.includes(t.id)) return "researched";
  const missing = t.requires.filter((r) => !s.unlocked.includes(r));
  if (missing.length) {
    const names = missing.map((r) => TECHS.find((x) => x.id === r)?.name ?? r);
    return `needs ${names.join(", ")}`;
  }
  if (s.cash < t.cost) return "not enough cash";
  return null;
}

export function research(s: GameState, techId: TechId): GameState {
  const t = TECHS.find((x) => x.id === techId);
  if (!t || techLock(s, t) !== null) return s;
  return latchQuests({
    ...s,
    unlocked: [...s.unlocked, techId],
    cash: s.cash - t.cost,
    message: `Researched: ${t.name}.`,
  });
}

export function toggleMute(s: GameState): GameState {
  return { ...s, muted: !s.muted };
}
