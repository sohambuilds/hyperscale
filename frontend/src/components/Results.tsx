import type { Score } from "../types";

interface ResultsProps {
  scenario: string | null;
  score: Score;
}

const int = (n: number): string => Math.round(n).toLocaleString();
const money = (n: number): string => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const pct = (n: number): string => (n * 100).toFixed(1) + "%";

export function Results({ scenario, score }: ResultsProps) {
  return (
    <div className="results-overlay">
      <div className="results-card">
        <h2>Run complete</h2>
        <p className="results-scenario">{scenario ?? ""}</p>
        <div className="results-grid">
          <Row label="Profit" value={money(score.profit)} accent={score.profit >= 0 ? "good" : "bad"} />
          <Row label="Mean SLO attainment" value={pct(score.mean_slo_attainment)} />
          <Row label="Reliability" value={pct(score.reliability)} />
          <Row label="Requests completed" value={int(score.requests_completed)} />
          <Row label="Requests churned" value={int(score.requests_churned)} />
          <Row label="Tokens served" value={int(score.tokens_served)} />
        </div>
        <button className="btn primary" onClick={() => location.reload()}>
          Run again
        </button>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  accent?: "good" | "bad";
}

function Row({ label, value, accent }: RowProps) {
  return (
    <div className="results-row">
      <span className="results-label">{label}</span>
      <span className={"results-value" + (accent ? " " + accent : "")}>{value}</span>
    </div>
  );
}
