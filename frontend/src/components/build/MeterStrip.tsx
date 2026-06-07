import { computeStats } from "../../game/engine";
import { fmt } from "../../format";
import type { GameState } from "../../game/types";

function Bar({ used, cap, tone }: { used: number; cap: number; tone: string }) {
  const frac = cap > 0 ? Math.min(1, used / cap) : 0;
  return (
    <div className="meter-bar">
      <div className={"meter-fill tone-" + tone} style={{ width: `${frac * 100}%` }} />
    </div>
  );
}

export function MeterStrip({ state }: { state: GameState }) {
  const m = computeStats(state);
  const deficit = m.gpus > m.gpusOnline;
  const onTrack = state.contracts.filter((c) => c.status === "on-track").length;
  const atRisk = state.contracts.filter((c) => c.status === "at-risk").length;
  const breaching = state.contracts.filter((c) => c.status === "breaching").length;

  const powerTone = m.powerCap === 0 ? (m.gpus > 0 ? "bad" : "dim") : m.powerUsed / m.powerCap > 0.9 ? "warn" : "ok";
  const coolTone = m.coolCap === 0 ? (m.gpus > 0 ? "bad" : "dim") : m.coolUsed / m.coolCap > 0.9 ? "warn" : "ok";
  const serveFrac = m.demand > 0 ? m.served / m.demand : 1;
  const serveTone = serveFrac >= 0.98 ? "ok" : serveFrac >= 0.85 ? "warn" : "bad";

  return (
    <div className="meters">
      <div className="meter">
        <span className="meter-label ds-label">
          power {deficit ? <em className="deficit">deficit</em> : null}
        </span>
        <span className="meter-val ds-num">
          {m.powerUsed.toFixed(1)}
          <span className="meter-cap">/{m.powerCap.toFixed(0)} kW</span>
        </span>
        <Bar used={m.powerUsed} cap={m.powerCap} tone={powerTone} />
        <span className="meter-foot ds-code">PUE {m.pue.toFixed(2)}</span>
      </div>

      <div className="meter">
        <span className="meter-label ds-label">cooling</span>
        <span className="meter-val ds-num">
          {m.coolUsed.toFixed(1)}
          <span className="meter-cap">/{m.coolCap.toFixed(0)} kW</span>
        </span>
        <Bar used={m.coolUsed} cap={m.coolCap} tone={coolTone} />
        <span className="meter-foot ds-code">{m.gpusOnline}/{m.gpus} GPUs online</span>
      </div>

      <div className="meter">
        <span className="meter-label ds-label">serving</span>
        <span className="meter-val ds-num">
          {fmt.int(m.served)}
          <span className="meter-cap">/{fmt.int(m.demand)} req/s</span>
        </span>
        <Bar used={m.served} cap={Math.max(m.demand, 1)} tone={serveTone} />
        <span className="meter-foot ds-code">{m.breached > 0 ? `${fmt.int(m.breached)} breached` : "keeping up"}</span>
      </div>

      <div className="meter">
        <span className="meter-label ds-label">contracts</span>
        <span className="meter-val contracts-counts ds-num">
          <span className="is-good">{onTrack}</span>
          <span className="sep">·</span>
          <span className="is-warn">{atRisk}</span>
          <span className="sep">·</span>
          <span className="is-bad">{breaching}</span>
        </span>
        <span className="meter-foot ds-code">on-track · at-risk · breaching</span>
      </div>
    </div>
  );
}
