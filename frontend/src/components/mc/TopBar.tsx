import { InfoTooltip } from "../InfoTooltip";
import type { ConnStatus, SessionControls } from "../../useSession";
import { fmt } from "../../format";
import { IconBtn } from "./primitives";
import { useAnimatedNumber } from "./hooks";

const SPEEDS = [1, 2, 4];

interface TopBarProps {
  status: ConnStatus;
  cash: number | null;
  profitHr: number;
  t: number;
  duration: number | null;
  speed: number;
  paused: boolean;
  finished: boolean;
  controls: SessionControls;
}

/** The triangle brand mark — three corner dots, one per strain hue (the soul of the game). */
function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 22 22">
        <polygon points="11,2 20,18 2,18" fill="none" stroke="var(--c-cyan)" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="11" cy="2" r="2" fill="var(--c-cyan)" />
        <circle cx="20" cy="18" r="2" fill="var(--c-amber)" />
        <circle cx="2" cy="18" r="2" fill="var(--c-magenta)" />
      </svg>
    </span>
  );
}

/** Ticking money counter — the hero number, easing toward the live balance. */
function MoneyCounter({ cash, profitHr }: { cash: number | null; profitHr: number }) {
  const eased = useAnimatedNumber(cash);
  const up = profitHr >= 0;
  const value = eased ?? cash ?? 0;
  return (
    <div className="money">
      <div className="money-label ds-label">
        <InfoTooltip term="cash">cash</InfoTooltip>
      </div>
      <div className={"money-val ds-num" + (value < 0 ? " neg" : "")}>{cash == null ? "—" : fmt.money(value)}</div>
      <div className={"money-rate ds-num " + (up ? "is-good" : "is-bad")}>
        {up ? "▲" : "▼"} {fmt.money(Math.abs(profitHr))}/hr
      </div>
    </div>
  );
}

export function TopBar({ status, cash, profitHr, t, duration, speed, paused, finished, controls }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <div className="brand-text">
          <span className="brand-name ds-brand">INFERENCE</span>
          <span className="brand-sub ds-label">Mission Control</span>
        </div>
        <span className={"conn conn-" + status}>
          <span className="conn-dot" />
          {status}
        </span>
      </div>

      <MoneyCounter cash={cash} profitHr={profitHr} />

      <div className="transport">
        <div className="clock">
          <span className="clock-label ds-label">
            <InfoTooltip term="time">ramp</InfoTooltip>
          </span>
          <span className="clock-val ds-num">
            {fmt.int(t)}
            <span className="clock-sep">/</span>
            {duration ?? "—"}s
          </span>
        </div>
        <div className="transport-btns">
          <IconBtn
            label={paused ? "Play" : "Pause"}
            disabled={finished}
            onClick={paused ? controls.play : controls.pause}
            icon={paused ? "▶" : "❚❚"}
          />
          <IconBtn label="Step" disabled={finished} onClick={controls.step} icon="▶❘" />
        </div>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={"speed" + (s === speed ? " on" : "")}
              disabled={finished}
              onClick={() => controls.setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
