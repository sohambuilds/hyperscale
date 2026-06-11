// The floating HUD top row, game-style: left cluster = identity (brand, level badge, cash chip),
// right cluster = facility rings, contracts chip, research, transport, system buttons. All chips
// live in chips.tsx; this file is layout + wiring.

import { TECHS } from "../../../game/config";
import { computeStats, techLock } from "../../../game/engine";
import { fmt } from "../../../format";
import type { GameState } from "../../../game/types";
import { BuildersChip, CashChip, ContractsChip, LevelBadge, UtilRings } from "./chips";
import { IconFlask, IconHelp } from "./icons";

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
  const stats = computeStats(state);
  const researchable = TECHS.filter((t) => techLock(state, t) === null).length;

  return (
    <header className="tyc-hud-row">
      {/* left: who you are + your money */}
      <div className="hud-cluster">
        <span className="gt-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 22 22">
            <polygon points="11,2 20,18 2,18" fill="none" stroke="var(--c-cyan)" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="11" cy="2" r="2" fill="var(--c-cyan)" />
            <circle cx="20" cy="18" r="2" fill="var(--c-amber)" />
            <circle cx="2" cy="18" r="2" fill="var(--c-magenta)" />
          </svg>
        </span>
        <LevelBadge state={state} />
        <CashChip state={state} ratePerMin={stats.profitPerSec * 60} />
      </div>

      {/* right: facility + panels + time */}
      <div className="hud-cluster">
        <BuildersChip state={state} />
        <UtilRings state={state} stats={stats} />

        <ContractsChip
          state={state}
          active={panel === "contracts"}
          attention={offersAttention}
          onClick={() => onTogglePanel("contracts")}
        />

        <button
          type="button"
          data-tut="research-tab"
          className={"chip btn-chip" + (panel === "research" ? " active" : "")}
          onClick={() => onTogglePanel("research")}
          title="Research — real serving techniques, real tradeoffs"
        >
          <span className="chip-icon is-violet">
            <IconFlask size={14} />
          </span>
          Research
          {researchable > 0 && <span className="rp-badge">{researchable}</span>}
        </button>

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
            <button key={s} type="button" className={"speed" + (s === state.speed ? " on" : "")} onClick={() => onSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMute}
          aria-label={state.muted ? "Unmute" : "Mute"}
          title={state.muted ? "Unmute" : "Mute"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
          <IconHelp size={15} />
        </button>
        <button type="button" className="gt-newgame" onClick={onReset} title="Start a new game">
          New game
        </button>
      </div>
    </header>
  );
}
