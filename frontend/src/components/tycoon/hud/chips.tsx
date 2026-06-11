// HUD chips — the Top Farm anatomy in our dark-neon skin: a Level badge with an XP ring, a
// cash chip that pops when money lands, three tiny utility rings (tap for the detailed meter
// flyout), and a contracts chip colored by the worst SLA status.

import { useEffect, useRef, useState } from "react";

import { GOAL_CASH } from "../../../game/config";
import { builderInfo } from "../../../game/engine";
import { levelFromRep, levelProgress, MAX_LEVEL, unlocksAtLevel } from "../../../game/level";
import { fmt } from "../../../format";
import type { GameState, Stats } from "../../../game/types";
import { useAnimatedNumber } from "../../mc/hooks";
import { MeterStrip } from "../../build/MeterStrip";
import { IconCoins, IconBolt, IconFan, IconHardHat, IconPulse, IconHex, IconScroll } from "./icons";

/** Hex badge + radial XP ring. Tooltip lists what the NEXT level unlocks. */
export function LevelBadge({ state }: { state: GameState }) {
  const level = levelFromRep(state.reputation);
  const prog = levelProgress(state.reputation);
  const next = level < MAX_LEVEL ? unlocksAtLevel(level + 1) : [];
  const R = 16;
  const C = 2 * Math.PI * R;
  const title =
    level >= MAX_LEVEL
      ? "Max operator level"
      : `Level ${level} — honour contracts and claim quests to level up.` +
        (next.length ? ` Next: ${next.join(", ")}` : "");
  return (
    <div className="lvl-badge" title={title}>
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r={R} fill="rgba(10,14,22,0.85)" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="19"
          cy="19"
          r={R}
          fill="none"
          stroke="var(--c-cyan)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${C * prog} ${C}`}
          transform="rotate(-90 19 19)"
          style={{ transition: "stroke-dasharray 400ms var(--ease-out)" }}
        />
      </svg>
      <span className="lvl-hex">
        <IconHex size={13} />
      </span>
      <span className="lvl-num ds-num">{level}</span>
      <span className="lvl-label ds-label">LVL</span>
    </div>
  );
}

/** Cash pill: count-up value, $/min rate, goal progress underline, pop on income bursts. */
export function CashChip({ state, ratePerMin }: { state: GameState; ratePerMin: number }) {
  const cash = useAnimatedNumber(state.cash) ?? state.cash;
  const [pop, setPop] = useState(false);
  const prev = useRef(state.cash);
  useEffect(() => {
    if (state.cash - prev.current >= 400) {
      setPop(true);
      const t = window.setTimeout(() => setPop(false), 320);
      prev.current = state.cash;
      return () => clearTimeout(t);
    }
    prev.current = state.cash;
  }, [state.cash]);

  const goalFrac = Math.max(0, Math.min(1, state.cash / GOAL_CASH));
  return (
    <div className={"chip cash-chip" + (pop ? " pop" : "")} title={`Goal: bank ${fmt.money(GOAL_CASH)}`}>
      <span className="chip-icon is-good">
        <IconCoins size={15} />
      </span>
      <div className="cash-chip-col">
        <span className={"cash-chip-val ds-num" + (state.cash < 0 ? " is-bad" : "")}>{fmt.money(cash)}</span>
        <span className={"cash-chip-rate ds-num " + (ratePerMin >= 0 ? "is-good" : "is-bad")}>
          {ratePerMin >= 0 ? "▲" : "▼"} {fmt.money(Math.abs(ratePerMin))}/min
        </span>
      </div>
      <div className="cash-goal">
        <div className="cash-goal-fill" style={{ width: `${goalFrac * 100}%` }} />
      </div>
    </div>
  );
}

interface RingProps {
  icon: React.ReactNode;
  used: number;
  cap: number;
  tone: string;
  hue: string; // the vital's identity color (healthy state) — warn/bad override it
  label: string;
}

function Ring({ icon, used, cap, tone, hue, label }: RingProps) {
  const frac = cap > 0 ? Math.min(1, used / cap) : 0;
  const R = 12;
  const C = 2 * Math.PI * R;
  return (
    <div className={"util-ring tone-" + tone} style={{ "--vh": hue } as React.CSSProperties} title={label}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.5" />
        <circle
          cx="15"
          cy="15"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`}
          transform="rotate(-90 15 15)"
          style={{ transition: "stroke-dasharray 300ms var(--ease-out)" }}
        />
      </svg>
      <span className="util-ring-icon">{icon}</span>
    </div>
  );
}

const toneFor = (used: number, cap: number, anyLoad: boolean): string =>
  cap <= 0 ? (anyLoad ? "bad" : "dim") : used / cap > 0.92 ? "warn" : "ok";

/** Three mini gauges (power / cooling / serving); click toggles the detailed meter flyout. */
export function UtilRings({ state, stats }: { state: GameState; stats: Stats }) {
  const [open, setOpen] = useState(false);
  const serveFrac = stats.demand > 0 ? stats.served / stats.demand : 1;
  const serveTone = serveFrac >= 0.98 ? "ok" : serveFrac >= 0.85 ? "warn" : "bad";
  const anyGpus = stats.gpus > 0;
  return (
    <div className="util-rings-wrap">
      <button
        type="button"
        className="util-rings"
        onClick={() => setOpen((o) => !o)}
        title="Facility vitals — click for detail"
        aria-expanded={open}
      >
        <Ring icon={<IconBolt size={11} />} used={stats.powerUsed} cap={stats.powerCap} tone={toneFor(stats.powerUsed, stats.powerCap, anyGpus)} hue="var(--c-orange)" label={`Power ${stats.powerUsed.toFixed(1)}/${stats.powerCap.toFixed(0)} kW`} />
        <Ring icon={<IconFan size={11} />} used={stats.coolUsed} cap={stats.coolCap} tone={toneFor(stats.coolUsed, stats.coolCap, anyGpus)} hue="var(--c-teal)" label={`Cooling ${stats.coolUsed.toFixed(1)}/${stats.coolCap.toFixed(0)} kW`} />
        <Ring icon={<IconPulse size={11} />} used={stats.served} cap={Math.max(stats.demand, 1)} tone={serveTone} hue="var(--c-cyan)" label={`Serving ${fmt.int(stats.served)}/${fmt.int(stats.demand)} req/s`} />
      </button>
      {open && (
        <div className="util-flyout">
          <MeterStrip state={state} />
        </div>
      )}
    </div>
  );
}

/** Build crew chip: idle/total builders; pulses while anything is under construction. */
export function BuildersChip({ state }: { state: GameState }) {
  const b = builderInfo(state);
  const building = b.busy > 0;
  return (
    <span
      className={"chip crew-chip" + (building ? " building" : "")}
      title={building ? `Build crew — ${b.busy} of ${b.total} constructing, ${b.free} idle` : `Build crew — ${b.total} builders idle`}
    >
      <span className={"chip-icon" + (building ? " is-warn" : "")}>
        <IconHardHat size={14} />
      </span>
      <span className="ds-num">
        {b.free}/{b.total}
      </span>
    </span>
  );
}

/** Contracts chip: worst status colors it; offers count badges it. */
export function ContractsChip({
  state,
  active,
  attention,
  onClick,
}: {
  state: GameState;
  active: boolean;
  attention: boolean;
  onClick: () => void;
}) {
  const onTrack = state.contracts.filter((c) => c.status === "on-track").length;
  const worst = state.contracts.some((c) => c.status === "breaching")
    ? "bad"
    : state.contracts.some((c) => c.status === "at-risk")
      ? "warn"
      : "ok";
  return (
    <button
      type="button"
      data-tut="contracts-tab"
      className={"chip btn-chip contracts-chip tone-" + worst + (active ? " active" : "")}
      onClick={onClick}
      title="Contracts — sign demand, watch SLA health"
    >
      <span className="chip-icon">
        <IconScroll size={14} />
      </span>
      <span className="ds-num">
        {onTrack}/{state.contracts.length}
      </span>
      {state.offers.length > 0 && (
        <span className={"rp-badge" + (attention ? " tyc-pulse" : "")}>{state.offers.length}</span>
      )}
    </button>
  );
}
