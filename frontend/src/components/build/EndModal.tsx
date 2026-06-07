import { fmt } from "../../format";
import type { GameState } from "../../game/types";

interface EndModalProps {
  state: GameState;
  onReset: () => void;
  onContinue: () => void;
}

export function EndModal({ state, onReset, onContinue }: EndModalProps) {
  if (state.status === "playing") return null;
  const won = state.status === "won";

  return (
    <div className="modal-scrim">
      <div className={"endcard panel" + (won ? " won" : " lost")}>
        <h2 className="endcard-title">{won ? "Goal reached" : "Game over"}</h2>
        <p className="endcard-sub ds-code">
          {won
            ? "You built a datacenter that serves AI inference at a profit."
            : "The cluster went dark — you couldn't cover the bills."}
        </p>
        <div className="endcard-grid">
          <Stat label="Peak cash" value={fmt.money(state.peakCash)} good={won} />
          <Stat label="Total earned" value={fmt.money(state.totalEarned)} />
          <Stat label="Requests served" value={fmt.int(state.servedTotal)} />
          <Stat label="Peak reputation" value={state.peakReputation.toFixed(1)} />
          <Stat label="Tech installed" value={`${state.unlocked.length}/6`} />
          <Stat label="Time" value={fmt.clock(state.tick)} />
        </div>
        <div className="endcard-actions">
          {won && (
            <button type="button" className="btn" onClick={onContinue}>
              Keep building
            </button>
          )}
          <button type="button" className="btn primary" onClick={onReset}>
            New game
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="endcard-stat">
      <span className="endcard-stat-label ds-label">{label}</span>
      <span className={"endcard-stat-val ds-num" + (good ? " is-good" : "")}>{value}</span>
    </div>
  );
}
