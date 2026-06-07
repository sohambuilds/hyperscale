import { BRANCHES, TECHS } from "../../game/config";
import { techLock } from "../../game/engine";
import { fmt } from "../../format";
import type { GameState, TechId } from "../../game/types";

interface ResearchPanelProps {
  state: GameState;
  onResearch: (id: TechId) => void;
}

/** Real serving tech tree, grouped into PARALLEL branches you can pursue independently. */
export function ResearchPanel({ state, onResearch }: ResearchPanelProps) {
  return (
    <section className="research">
      <p className="research-intro ds-code">
        Four independent branches — research any branch's root anytime, in parallel. Each is a real
        technique with a real catch.
      </p>
      {BRANCHES.map((b) => (
        <div key={b.key} className="branch">
          <div className={"branch-head ds-label branch-" + b.key}>{b.name}</div>
          {TECHS.filter((t) => t.branch === b.key).map((t) => {
            const lock = techLock(state, t);
            const owned = state.unlocked.includes(t.id);
            return (
              <div key={t.id} className={"tech" + (owned ? " owned" : "") + (lock && !owned ? " locked" : "")}>
                <div className="tech-head">
                  <span className="tech-name">{t.name}</span>
                  {owned ? <span className="tech-owned ds-label">installed</span> : <span className="tech-cost ds-num">{fmt.money(t.cost)}</span>}
                </div>
                <p className="tech-effect">{t.effect}</p>
                <p className="tech-tradeoff ds-code">↳ {t.tradeoff}</p>
                {!owned && (
                  <button type="button" className="btn primary sm tech-btn" disabled={lock !== null} onClick={() => onResearch(t.id)}>
                    {lock === null ? "Research" : lock}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
