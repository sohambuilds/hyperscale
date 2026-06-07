import { useEffect } from "react";

import type { Tutorial as TutorialState } from "../../game/tutorial";

/** Non-blocking coach card + a highlight ring on the control the current step refers to. */
export function Tutorial({ tut }: { tut: TutorialState }) {
  const target = tut.step?.target;

  useEffect(() => {
    if (!target) return;
    const els = Array.from(document.querySelectorAll(`[data-tut="${target}"]`));
    els.forEach((e) => e.classList.add("tut-highlight"));
    return () => els.forEach((e) => e.classList.remove("tut-highlight"));
  }, [target, tut.index]);

  if (!tut.active || !tut.step) return null;
  const step = tut.step;
  const isInfo = !step.done;
  const isLast = tut.index === tut.total - 1;

  return (
    <div className="tut-coach">
      <div className="tut-head">
        <span className="tut-eyebrow ds-label">Tutorial · {tut.index + 1}/{tut.total}</span>
        <button type="button" className="tut-skip" onClick={tut.skip}>
          Skip
        </button>
      </div>
      <h3 className="tut-title">{step.title}</h3>
      <p className="tut-body">{step.body}</p>
      <div className="tut-actions">
        {isLast ? (
          <button type="button" className="btn primary sm" onClick={tut.next}>
            Start playing
          </button>
        ) : isInfo ? (
          <button type="button" className="btn primary sm" onClick={tut.next}>
            Next
          </button>
        ) : (
          <span className="tut-waiting ds-code">↳ do the highlighted step to continue</span>
        )}
      </div>
    </div>
  );
}
