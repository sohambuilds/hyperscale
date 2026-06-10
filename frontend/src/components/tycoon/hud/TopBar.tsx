// Floating command bar: brand · ticking cash + goal · clock/rep/transport + panel openers.
// Adapted from build/GameTopBar (same classes/tokens) with two additions for the full-viewport
// shell: a reputation readout and Contracts/Research panel buttons with badges.

import { GOAL_CASH, TECHS } from "../../../game/config";
import { computeStats, techLock } from "../../../game/engine";
import { fmt } from "../../../format";
import type { GameState } from "../../../game/types";
import { useAnimatedNumber } from "../../mc/hooks";

const SPEEDS = [1, 2, 4];

export type PanelKind = "inspector" | "contracts" | "research";

interface TopBarProps {
  state: GameState;
  panel: PanelKind | null;
  offersAttention: boolean;
  onPlayPause: () => void;
  onSpeed: (s: number) => void;
  onToggleMute: () => void;
  onReset: () => void;
  onTutorial: () => void;
  onTogglePanel: (p: "contracts" | "research") => void;
}

export function TopBar({
  state,
  panel,
  offersAttention,
  onPlayPause,
  onSpeed,
  onToggleMute,
  onReset,
  onTutorial,
  onTogglePanel,
}: TopBarProps) {
  const m = computeStats(state);
  const cash = useAnimatedNumber(state.cash) ?? state.cash;
  const ratePerMin = m.profitPerSec * 60;
  const goalFrac = Math.max(0, Math.min(1, state.cash / GOAL_CASH));
  const researchable = TECHS.filter((t) => techLock(state, t) === null).length;

  return (
    <header className="gtopbar tyc-bar">
      <div className="gt-brand">
        <span className="gt-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 22 22">
            <polygon
              points="11,2 20,18 2,18"
              fill="none"
              stroke="var(--c-cyan)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="11" cy="2" r="2" fill="var(--c-cyan)" />
            <circle cx="20" cy="18" r="2" fill="var(--c-amber)" />
            <circle cx="2" cy="18" r="2" fill="var(--c-magenta)" />
          </svg>
        </span>
        <div className="gt-name">
          <span className="ds-brand">INFERENCE</span>
          <span className="gt-sub ds-label">ai datacenter tycoon</span>
        </div>
      </div>

      <div className="gt-cash">
        <div className="gt-cash-row">
          <span className={"gt-cash-val ds-num" + (state.cash < 0 ? " neg" : "")}>{fmt.money(cash)}</span>
          <span className={"gt-rate ds-num " + (ratePerMin >= 0 ? "is-good" : "is-bad")}>
            {ratePerMin >= 0 ? "▲" : "▼"} {fmt.money(Math.abs(ratePerMin))}/min
          </span>
        </div>
        <div className="gt-goal" title={`Goal: ${fmt.money(GOAL_CASH)}`}>
          <div className="gt-goal-fill" style={{ width: `${goalFrac * 100}%` }} />
          <span className="gt-goal-label ds-code">goal {fmt.money(GOAL_CASH)}</span>
        </div>
      </div>

      <div className="gt-transport">
        <span className="tyc-rep ds-num" title="Reputation — honour contracts to raise it; unlocks better hardware and clients">
          ★ {state.reputation.toFixed(1)}
        </span>
        <span className="gt-clock ds-num">{fmt.clock(state.tick)}</span>
        <button
          type="button"
          data-tut="play"
          className="icon-btn big"
          onClick={onPlayPause}
          aria-label={state.paused ? "Play" : "Pause"}
          disabled={state.status !== "playing"}
        >
          {state.paused ? "▶" : "❚❚"}
        </button>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={"speed" + (s === state.speed ? " on" : "")}
              onClick={() => onSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>

        <button
          type="button"
          data-tut="contracts-tab"
          className={"icon-btn tyc-btn-labeled" + (panel === "contracts" ? " active" : "")}
          onClick={() => onTogglePanel("contracts")}
          title="Contracts — sign demand, watch SLA health"
        >
          Contracts
          {state.offers.length > 0 && (
            <span className={"rp-badge" + (offersAttention ? " tyc-pulse" : "")}>{state.offers.length}</span>
          )}
        </button>
        <button
          type="button"
          data-tut="research-tab"
          className={"icon-btn tyc-btn-labeled" + (panel === "research" ? " active" : "")}
          onClick={() => onTogglePanel("research")}
          title="Research — real serving techniques, real tradeoffs"
        >
          Research
          {researchable > 0 && <span className="rp-badge">{researchable}</span>}
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMute}
          aria-label={state.muted ? "Unmute" : "Mute"}
          title={state.muted ? "Unmute" : "Mute"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 6 H5 L8 3 V13 L5 10 H2.5 Z" fill="currentColor" stroke="none" />
            {state.muted ? (
              <path d="M11 6 L14 10 M14 6 L11 10" />
            ) : (
              <>
                <path d="M10.5 5.5 a3.2 3.2 0 0 1 0 5" />
                <path d="M12.3 4 a5.5 5.5 0 0 1 0 8" />
              </>
            )}
          </svg>
        </button>
        <button type="button" className="icon-btn" onClick={onTutorial} aria-label="How to play" title="How to play">
          ?
        </button>
        <button type="button" className="gt-newgame" onClick={onReset} title="Start a new game">
          New game
        </button>
      </div>
    </header>
  );
}
