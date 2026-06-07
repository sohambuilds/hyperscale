import { useCallback, useEffect, useRef, useState } from "react";

import { setMuted, sfx, startHum, stopHum } from "./audio";
import { TICK_MS } from "./config";
import { bumpId } from "./contracts";
import * as E from "./engine";
import type { GameState, GpuTierId, PlaceableKind, Policy, TechId, Tool } from "./types";

const SAVE_KEY = "hyperscale.builder.v3";

function maxIdIn(s: GameState): number {
  let max = 0;
  const scan = (id: string) => {
    const n = Number(id.split("-")[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  };
  s.placed.forEach((p) => scan(p.id));
  s.contracts.forEach((c) => scan(c.id));
  s.offers.forEach((o) => scan(o.id));
  return max;
}

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.cash !== "number" || !Array.isArray(obj.placed)) return null;
    const merged: GameState = { ...E.emptyState(), ...obj, fx: [], paused: true };
    bumpId(maxIdIn(merged));
    return merged;
  } catch {
    return null;
  }
}

function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, fx: [] }));
  } catch {
    /* storage unavailable */
  }
}

export interface Game {
  state: GameState;
  setTool: (tool: Tool) => void;
  tapTile: (col: number, row: number) => void;
  selectId: (id: string | null) => void;
  installGpu: (rackId: string) => void;
  removeGpu: (rackId: string) => void;
  setPolicy: (rackId: string, policy: Policy) => void;
  setGpuType: (rackId: string, tier: GpuTierId) => void;
  upgradePower: (id: string) => void;
  upgradeCooling: (id: string) => void;
  sell: (id: string) => void;
  accept: (offerId: string) => void;
  decline: (offerId: string) => void;
  research: (techId: TechId) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  toggleMute: () => void;
  reset: () => void;
  continueRun: () => void;
}

export function useGame(): Game {
  const [state, setState] = useState<GameState>(() => load() ?? E.emptyState());
  const ref = useRef(state);
  ref.current = state;

  // tick loop — stops when paused or the run has ended
  useEffect(() => {
    if (state.paused || state.status !== "playing") return;
    const id = window.setInterval(() => setState((s) => E.tick(s, 1)), TICK_MS / state.speed);
    return () => clearInterval(id);
  }, [state.paused, state.speed, state.status]);

  // persist (sanitized) on change
  useEffect(() => {
    save(state);
  }, [state]);

  // audio: mute + ambient hum
  useEffect(() => setMuted(state.muted), [state.muted]);
  useEffect(() => {
    if (!state.paused && state.status === "playing" && !state.muted) startHum();
    else stopHum();
  }, [state.paused, state.status, state.muted]);

  // audio: react to win/lose + new breaches
  const prev = useRef({ status: state.status, breaching: 0 });
  useEffect(() => {
    const breaching = state.contracts.filter((c) => c.status === "breaching").length;
    if (state.status !== prev.current.status) {
      if (state.status === "won") sfx.win();
      else if (state.status === "lost") sfx.breach();
    } else if (breaching > prev.current.breaching) {
      sfx.breach();
    }
    prev.current = { status: state.status, breaching };
  }, [state.status, state.contracts]);

  const setTool = useCallback((tool: Tool) => {
    sfx.click();
    setState((s) => ({ ...s, tool, selectedId: tool === "cursor" ? s.selectedId : null }));
  }, []);

  const tapTile = useCallback((col: number, row: number) => {
    const cur = ref.current;
    const item = cur.placed.find((p) => p.col === col && p.row === row);
    if (cur.tool === "cursor") {
      sfx.click();
      setState((s) => ({ ...s, selectedId: item ? item.id : null }));
      return;
    }
    if (cur.tool === "sell") {
      if (item) {
        sfx.place();
        setState(E.sellAt(cur, item.id));
      }
      return;
    }
    const next = E.place(cur, cur.tool as PlaceableKind, col, row);
    if (next.placed.length > cur.placed.length) sfx.place();
    else sfx.error();
    setState(next);
  }, []);

  const selectId = useCallback(
    (id: string | null) => setState((s) => ({ ...s, selectedId: id, tool: "cursor" })),
    [],
  );

  const installGpu = useCallback((rackId: string) => {
    const cur = ref.current;
    const next = E.installGpu(cur, rackId);
    if (next.cash < cur.cash) sfx.install();
    else sfx.error();
    setState(next);
  }, []);

  const removeGpu = useCallback((rackId: string) => {
    sfx.click();
    setState((s) => E.removeGpu(s, rackId));
  }, []);

  const setPolicy = useCallback((rackId: string, policy: Policy) => {
    sfx.click();
    setState((s) => E.setPolicy(s, rackId, policy));
  }, []);

  const setGpuType = useCallback((rackId: string, tier: GpuTierId) => {
    sfx.click();
    setState((s) => E.setGpuType(s, rackId, tier));
  }, []);

  const upgradePower = useCallback((id: string) => {
    const cur = ref.current;
    const next = E.upgradePower(cur, id);
    if (next.cash < cur.cash) sfx.install();
    else sfx.error();
    setState(next);
  }, []);

  const upgradeCooling = useCallback((id: string) => {
    const cur = ref.current;
    const next = E.upgradeCooling(cur, id);
    if (next.cash < cur.cash) sfx.install();
    else sfx.error();
    setState(next);
  }, []);

  const sell = useCallback((id: string) => {
    sfx.place();
    setState((s) => E.sellAt(s, id));
  }, []);

  const accept = useCallback((offerId: string) => {
    sfx.cash();
    startHum();
    setState((s) => E.acceptOffer(s, offerId));
  }, []);

  const decline = useCallback((offerId: string) => {
    sfx.click();
    setState((s) => E.declineOffer(s, offerId));
  }, []);

  const research = useCallback((techId: TechId) => {
    const cur = ref.current;
    const next = E.research(cur, techId);
    if (next.unlocked.length > cur.unlocked.length) sfx.unlock();
    else sfx.error();
    setState(next);
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    if (paused) stopHum();
    else startHum();
    setState((s) => ({ ...s, paused }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    sfx.click();
    setState((s) => ({ ...s, speed }));
  }, []);

  const toggleMute = useCallback(() => setState((s) => E.toggleMute(s)), []);

  const continueRun = useCallback(
    () => setState((s) => ({ ...s, status: "playing", bankruptT: 0 })),
    [],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    sfx.click();
    setState(E.emptyState());
  }, []);

  return {
    state,
    setTool,
    tapTile,
    selectId,
    installGpu,
    removeGpu,
    setPolicy,
    setGpuType,
    upgradePower,
    upgradeCooling,
    sell,
    accept,
    decline,
    research,
    setPaused,
    setSpeed,
    toggleMute,
    reset,
    continueRun,
  };
}
