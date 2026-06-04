import type { ControlMsg } from "../types";

// Build the WebSocket URL. Defaults to the local sim server; override with VITE_WS_URL.
// Scenario/seed can be set via the page query string (?scenario=ramp&seed=2).
export function wsUrl(): string {
  const base = import.meta.env.VITE_WS_URL ?? `ws://${location.hostname}:8000/ws`;
  const params = new URLSearchParams(location.search);
  const scenario = params.get("scenario") ?? "ramp";
  const seed = params.get("seed") ?? "1";
  return `${base}?scenario=${encodeURIComponent(scenario)}&seed=${encodeURIComponent(seed)}`;
}

export function sendControl(ws: WebSocket | null, msg: ControlMsg): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
