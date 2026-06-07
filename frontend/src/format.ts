// Number formatters for the dashboard. Every technical number is rendered in IBM Plex Mono
// with tabular figures (see .ds-num); these just decide the string. Units are always shown,
// thousands grouped, money uses a real "$" with a true minus (−) for negatives.

export const fmt = {
  int: (n: number): string => Math.round(n).toLocaleString(),
  money: (n: number): string => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString(),
  money2: (n: number): string => (n < 0 ? "−$" : "$") + Math.abs(n).toFixed(2),
  pct: (n: number, d = 1): string => (n * 100).toFixed(d) + "%",
  // ttft/tpot arrive in seconds; show ms under a second, s above it.
  ms: (s: number): string => (s >= 1 ? s.toFixed(2) + " s" : Math.round(s * 1000) + " ms"),
  kw: (w: number): string => (w / 1000).toFixed(1),
  tok: (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : Math.round(n).toString()),
  // mm:ss clock from a count of seconds.
  clock: (s: number): string =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`,
};
