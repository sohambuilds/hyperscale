import type { Observation } from "../types";
import type { ConnStatus } from "../useSession";
import { InfoTooltip } from "./InfoTooltip";

interface StatBarProps {
  scenario: string | null;
  status: ConnStatus;
  durationS: number | null;
  observation: Observation | null;
}

const int = (n: number): string => Math.round(n).toLocaleString();
const money = (n: number): string => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const pct = (n: number): string => (n * 100).toFixed(1) + "%";

export function StatBar({ scenario, status, durationS, observation }: StatBarProps) {
  const m = observation?.metrics;
  const t = m ? Math.round(m.t) : 0;

  return (
    <header className="statbar">
      <div className="brand">
        <span className="brand-name">INFERENCE</span>
        <span className={"conn conn-" + status}>{status}</span>
      </div>
      <div className="stat-tiles">
        <Tile label="scenario" term="scenario" value={scenario ?? "—"} />
        <Tile label="time" term="time" value={`${t} / ${durationS ?? "—"} s`} />
        <Tile label="cash" term="cash" value={observation ? money(observation.cash) : "—"} />
        <Tile label="SLO" term="slo" value={m ? pct(m.slo_attainment) : "—"} />
        <Tile label="queue" term="queue" value={m ? int(m.queue_depth) : "—"} />
        <Tile label="power" term="power" value={m ? `${int(m.power_w)} / ${int(m.power_budget_w)} W` : "—"} />
        <Tile label="throughput" term="throughput" value={m ? `${int(m.throughput_tok_s)} tok/s` : "—"} />
      </div>
    </header>
  );
}

interface TileProps {
  label: string;
  value: string;
  term?: string;
}

function Tile({ label, value, term }: TileProps) {
  return (
    <div className="tile">
      <span className="tile-label">
        {term ? <InfoTooltip term={term}>{label}</InfoTooltip> : label}
      </span>
      <span className="tile-value">{value}</span>
    </div>
  );
}
