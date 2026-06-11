// The quest chain — sequenced goals that hand direction to the player after the tutorial.
// Same philosophy as the tutorial: quests are DETECTED from state (never clicked-to-progress);
// the one click is claiming the reward. Progress for transient conditions (peak req/s, hold a
// strict SLA, profit rate) is accumulated into state.questProg by tick() so completion is
// stable — a quest that was earned stays claimable even if the condition later lapses.

import type { GameState, Stats } from "./types";

export interface QuestSpec {
  id: string;
  title: string;
  detail: string;
  target: number;
  /** Current progress toward target (clamped for display). */
  progress: (s: GameState) => number;
  reward: { cash: number; rep: number };
}

// --- questProg counters maintained by the engine each tick ----------------------------------
// peakServed   : high-water of stats.served (req/s)
// peakRateMin  : high-water of profit $/min
// strictHold   : longest consecutive run of ticks with ≥1 strict contract on-track
// strictHoldCur: (internal) current consecutive run
export function updateQuestProg(s: GameState, stats: Stats): Record<string, number> {
  const q = { ...s.questProg };
  q.peakServed = Math.max(q.peakServed ?? 0, stats.served);
  q.peakRateMin = Math.max(q.peakRateMin ?? 0, stats.profitPerSec * 60);
  const strictOn = s.contracts.some((c) => c.strict && c.status === "on-track");
  const cur = strictOn ? (q.strictHoldCur ?? 0) + 1 : 0;
  q.strictHoldCur = cur;
  q.strictHold = Math.max(q.strictHold ?? 0, cur);
  return q;
}

const gpuCount = (s: GameState): number =>
  s.placed.reduce((a, p) => a + (p.kind === "rack" ? p.gpus ?? 0 : 0), 0);

export const QUESTS: QuestSpec[] = [
  {
    id: "first_power",
    title: "Light it up",
    detail: "Build a Power unit.",
    target: 1,
    progress: (s) => s.placed.filter((p) => p.kind === "power").length,
    reward: { cash: 500, rep: 0.1 },
  },
  {
    id: "first_gpus",
    title: "Metal in the racks",
    detail: "Install 2 GPU servers.",
    target: 2,
    progress: gpuCount,
    reward: { cash: 800, rep: 0.1 },
  },
  {
    id: "first_contract",
    title: "Open for business",
    detail: "Sign your first contract.",
    target: 1,
    // transient is fine — completion latches into questDone the tick it first passes
    progress: (s) => (s.contracts.length > 0 ? 1 : 0),
    reward: { cash: 800, rep: 0.1 },
  },
  {
    id: "serve_1k",
    title: "First thousand",
    detail: "Serve 1,000 requests in total.",
    target: 1000,
    progress: (s) => s.servedTotal,
    reward: { cash: 1000, rep: 0.15 },
  },
  {
    id: "both_policies",
    title: "Two kinds of fast",
    detail: "Run a Latency rack and a Throughput rack at the same time (GPUs in both).",
    target: 1,
    progress: (s) => {
      const lat = s.placed.some((p) => p.kind === "rack" && (p.gpus ?? 0) > 0 && p.policy === "latency");
      const thru = s.placed.some((p) => p.kind === "rack" && (p.gpus ?? 0) > 0 && (p.policy ?? "throughput") === "throughput");
      return lat && thru ? 1 : 0;
    },
    reward: { cash: 1500, rep: 0.2 },
  },
  {
    id: "first_tech",
    title: "Read the papers",
    detail: "Research any serving technique.",
    target: 1,
    progress: (s) => s.unlocked.length,
    reward: { cash: 1000, rep: 0.15 },
  },
  {
    id: "strict_hold",
    title: "Promise keeper",
    detail: "Keep a strict-SLA contract on-track for 60 seconds straight.",
    target: 60,
    progress: (s) => s.questProg.strictHold ?? 0,
    reward: { cash: 2000, rep: 0.3 },
  },
  {
    id: "serve_300",
    title: "Open the floodgates",
    detail: "Serve 300 req/s at once.",
    target: 300,
    progress: (s) => s.questProg.peakServed ?? 0,
    reward: { cash: 2000, rep: 0.25 },
  },
  {
    id: "three_contracts",
    title: "Portfolio manager",
    detail: "Hold 3 active contracts at the same time.",
    target: 3,
    progress: (s) => s.contracts.length,
    reward: { cash: 1500, rep: 0.2 },
  },
  {
    id: "researcher",
    title: "Serving-stack scholar",
    detail: "Research 3 techniques.",
    target: 3,
    progress: (s) => s.unlocked.length,
    reward: { cash: 2500, rep: 0.3 },
  },
  {
    id: "big_fleet",
    title: "Hyperscale-ish",
    detail: "Have 8 GPU servers installed.",
    target: 8,
    progress: gpuCount,
    reward: { cash: 2500, rep: 0.3 },
  },
  {
    id: "rate_300",
    title: "Money machine",
    detail: "Reach a profit rate of $300/min.",
    target: 300,
    progress: (s) => s.questProg.peakRateMin ?? 0,
    reward: { cash: 2500, rep: 0.3 },
  },
  {
    id: "half_goal",
    title: "Halfway to hyperscaler",
    detail: "Bank $50,000 cash.",
    target: 50_000,
    progress: (s) => s.peakCash,
    reward: { cash: 4000, rep: 0.4 },
  },
];

const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));
export const questById = (id: string): QuestSpec | undefined => QUEST_BY_ID.get(id);

/** Quests newly completed this tick (progress hit target, not yet in questDone). */
export function detectDone(s: GameState): string[] {
  const out: string[] = [];
  for (const q of QUESTS) {
    if (s.questDone.includes(q.id)) continue;
    if (q.progress(s) >= q.target) out.push(q.id);
  }
  return out;
}

/** The quests to show: claimable (done, unclaimed) first, then the next few open ones. */
export function visibleQuests(s: GameState, openCount = 3): { claimable: QuestSpec[]; open: QuestSpec[] } {
  const claimable = QUESTS.filter((q) => s.questDone.includes(q.id) && !s.questClaimed.includes(q.id));
  const open = QUESTS.filter((q) => !s.questDone.includes(q.id)).slice(0, openCount);
  return { claimable, open };
}
