import type { LogItem, ToastItem } from "./hooks";

/** Terminal-style scrolling event log — the running story of the cluster. */
export function EventLog({ events }: { events: LogItem[] }) {
  return (
    <div className="eventlog">
      <div className="eventlog-head ds-label">event log</div>
      <div className="eventlog-body">
        {events.length === 0 ? (
          <div className="log-line log-info">
            <span className="log-msg">awaiting telemetry…</span>
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className={"log-line log-" + e.kind}>
              <span className="log-t ds-num">{e.ts}</span>
              <span className="log-tag">{e.tag}</span>
              <span className="log-msg">{e.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Incident / event toasts — the juicy moments (spikes, breaches, scale actions). */
export function ToastFeed({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toasts">
      {toasts.map((tt) => (
        <div key={tt.id} className={"toast toast-" + tt.kind}>
          <span className="toast-icon">{tt.icon}</span>
          <div className="toast-text">
            <div className="toast-title">{tt.title}</div>
            <div className="toast-detail">{tt.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
