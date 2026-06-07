import { useCallback, useEffect, useState } from "react";

import type { GameState } from "./types";

// A guided, non-blocking tutorial: each step highlights the relevant control (via a [data-tut]
// attribute) and auto-advances when the player actually performs the action. Info steps advance
// on "Next". Completion is remembered so it only shows on the first play.

const TUT_KEY = "hyperscale.tutorial.done.v1";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  target?: string; // matches [data-tut="..."] — gets a highlight ring
  done?: (s: GameState) => boolean; // when true, auto-advance (else wait for "Next")
}

const gpuCount = (s: GameState): number =>
  s.placed.reduce((a, p) => a + (p.kind === "rack" ? p.gpus ?? 0 : 0), 0);
const has = (s: GameState, kind: string): boolean => s.placed.some((p) => p.kind === kind);

export const STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome, operator",
    body: "You're building a datacenter to serve AI inference for profit. Let's get your first servers online — it takes about a minute.",
  },
  {
    id: "power",
    title: "1 · Lay down power",
    body: "Everything needs power. Pick Power from the toolbar, then click an empty tile on the floor to build it.",
    target: "power",
    done: (s) => has(s, "power"),
  },
  {
    id: "cooling",
    title: "2 · Add cooling",
    body: "GPUs run hot. Pick Cooling and place a unit — without it, servers overheat and shut off.",
    target: "cooling",
    done: (s) => has(s, "cooling"),
  },
  {
    id: "rack",
    title: "3 · Place a rack",
    body: "Racks hold your GPU servers. Pick Server rack and drop one on the floor.",
    target: "rack",
    done: (s) => has(s, "rack"),
  },
  {
    id: "install",
    title: "4 · Install GPUs",
    body: "Click the rack to select it, then press + Install to add two GPU servers in the Inspect panel.",
    target: "build",
    done: (s) => gpuCount(s) >= 2,
  },
  {
    id: "dial",
    title: "5 · The serving dial",
    body: "Each rack runs Throughput (big batches, high req/s) or Latency (small batches, meets strict SLAs). Different contracts need different pools — this is the core decision.",
  },
  {
    id: "contract",
    title: "6 · Sign a contract",
    body: "Open the Contracts tab and Sign an offer. That's your demand — and your income.",
    target: "contracts-tab",
    done: (s) => s.contracts.length >= 1,
  },
  {
    id: "play",
    title: "7 · Go live",
    body: "Press ▶ to open for business. Watch cash tick as you serve requests.",
    target: "play",
    done: (s) => !s.paused,
  },
  {
    id: "done",
    title: "You're live!",
    body: "If a strict contract starts breaching, switch a rack to Latency or add capacity. Over-build and idle GPUs bleed cash; under-build and you breach. Research new tech to do more with less. Goal: reach $100,000. Good luck!",
  },
];

export interface Tutorial {
  active: boolean;
  step: TutorialStep | null;
  index: number;
  total: number;
  next: () => void;
  skip: () => void;
  restart: () => void;
}

export function useTutorial(state: GameState): Tutorial {
  const [active, setActive] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(TUT_KEY);
    } catch {
      return true;
    }
  });
  const [index, setIndex] = useState(0);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(TUT_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= STEPS.length) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  // auto-advance when the current step's action is completed
  useEffect(() => {
    if (!active) return;
    const step = STEPS[index];
    if (step?.done && step.done(state)) {
      const t = window.setTimeout(advance, 450);
      return () => clearTimeout(t);
    }
  }, [active, index, state, advance]);

  const restart = useCallback(() => {
    try {
      localStorage.removeItem(TUT_KEY);
    } catch {
      /* ignore */
    }
    setIndex(0);
    setActive(true);
  }, []);

  return {
    active,
    step: active ? STEPS[index] : null,
    index,
    total: STEPS.length,
    next: advance,
    skip: finish,
    restart,
  };
}
