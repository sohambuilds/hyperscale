// Quest tray — bottom-left button + slide-out goal list. Claimable rewards first (big claim
// button), then the next open goals with live progress bars. The one click is the claim.

import { useState } from "react";

import { visibleQuests } from "../../../game/quests";
import { fmt } from "../../../format";
import type { GameState } from "../../../game/types";
import { IconCheck, IconTarget } from "./icons";

export function QuestTray({ state, onClaim }: { state: GameState; onClaim: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { claimable, open: openQuests } = visibleQuests(state);
  const allDone = claimable.length === 0 && openQuests.length === 0;

  return (
    <div className="quest-wrap">
      <button
        type="button"
        className={"chip btn-chip quest-btn" + (open ? " active" : "")}
        onClick={() => setOpen((o) => !o)}
        title="Quests — goals with rewards"
        aria-expanded={open}
      >
        <span className="chip-icon is-accent">
          <IconTarget size={15} />
        </span>
        Quests
        {claimable.length > 0 && <span className="rp-badge tyc-pulse">{claimable.length}</span>}
      </button>

      {open && (
        <div className="quest-tray">
          <div className="quest-tray-head ds-label">goals</div>
          {allDone && <p className="quest-empty ds-code">All goals complete — you're a real operator now.</p>}

          {claimable.map((q) => (
            <div key={q.id} className="quest done">
              <div className="quest-row">
                <span className="quest-check is-good">
                  <IconCheck size={13} />
                </span>
                <div className="quest-text">
                  <span className="quest-title">{q.title}</span>
                  <span className="quest-detail ds-code">{q.detail}</span>
                </div>
              </div>
              <button type="button" className="btn primary sm quest-claim" onClick={() => onClaim(q.id)}>
                Claim {fmt.money(q.reward.cash)}
              </button>
            </div>
          ))}

          {openQuests.map((q) => {
            const prog = Math.max(0, Math.min(q.target, q.progress(state)));
            const frac = q.target > 0 ? prog / q.target : 0;
            return (
              <div key={q.id} className="quest">
                <div className="quest-row">
                  <div className="quest-text">
                    <span className="quest-title">{q.title}</span>
                    <span className="quest-detail ds-code">{q.detail}</span>
                  </div>
                  <span className="quest-reward ds-num">{fmt.money(q.reward.cash)}</span>
                </div>
                <div className="quest-bar">
                  <div className="quest-bar-fill" style={{ width: `${frac * 100}%` }} />
                </div>
                <span className="quest-prog ds-code">
                  {q.target > 1 ? `${fmt.int(prog)} / ${fmt.int(q.target)}` : prog >= 1 ? "done" : "not yet"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
