import { useCallback, useEffect, useRef, useState } from "react";

import type { Strains } from "../../mission";
import type { Observation } from "../../types";
import { fmt } from "../../format";

// Live-effects hooks for Mission Control: a count-up money counter, the eased triangle lean,
// and the incident toast / event-log feed. These add the "juicy, springy" life the design asks
// for on top of the real 1 Hz tick stream.

const hidden = (): boolean => typeof document !== "undefined" && document.hidden;

/**
 * Ease a displayed number toward `target` so the money counter ticks instead of snapping.
 * Driven by an interval (not rAF) so it keeps tracking even when the tab is backgrounded —
 * when hidden it snaps to the target rather than freezing mid-ease.
 */
export function useAnimatedNumber(target: number | null, k = 0.16): number | null {
  const [disp, setDisp] = useState<number | null>(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    const id = window.setInterval(() => {
      setDisp((prev) => {
        const t = targetRef.current;
        if (t == null || prev == null) return t;
        if (hidden()) return t === prev ? prev : t; // snap when throttled
        const next = prev + (t - prev) * k;
        return Math.abs(t - next) < 0.5 ? t : next;
      });
    }, 33);
    return () => clearInterval(id);
  }, [k]);

  return disp;
}

/** Ease the three corner strains toward their live targets so the triangle leans, not jumps. */
export function useEasedStrains(target: Strains, k = 0.14): Strains {
  const targetRef = useRef(target);
  targetRef.current = target;
  const [disp, setDisp] = useState<Strains>(target);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDisp((prev) => {
        const t = targetRef.current;
        if (hidden()) {
          // snap when throttled (background tab) so the triangle never shows a stale lean
          return prev.latency === t.latency && prev.cost === t.cost && prev.traffic === t.traffic
            ? prev
            : { ...t };
        }
        const next: Strains = {
          latency: prev.latency + (t.latency - prev.latency) * k,
          cost: prev.cost + (t.cost - prev.cost) * k,
          traffic: prev.traffic + (t.traffic - prev.traffic) * k,
        };
        const moved =
          Math.abs(next.latency - prev.latency) +
          Math.abs(next.cost - prev.cost) +
          Math.abs(next.traffic - prev.traffic);
        return moved < 0.0008 ? prev : next;
      });
    }, 33);
    return () => clearInterval(id);
  }, [k]);

  return disp;
}

export type FeedKind = "info" | "warn" | "bad" | "good";

export interface ToastItem {
  id: number;
  kind: FeedKind;
  icon: string;
  title: string;
  detail: string;
}

export interface LogItem {
  id: number;
  ts: string;
  tag: string;
  kind: FeedKind;
  msg: string;
}

export interface EventFeed {
  toasts: ToastItem[];
  events: LogItem[];
  pushToast: (kind: FeedKind, icon: string, title: string, detail: string) => void;
  pushEvent: (kind: FeedKind, tag: string, ts: string, msg: string) => void;
}

/** Toast + event-log feed: toasts auto-dismiss; the log keeps the last few lines. */
export function useEventFeed(): EventFeed {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [events, setEvents] = useState<LogItem[]>([]);
  const idRef = useRef(1);
  const timers = useRef<number[]>([]);

  const pushToast = useCallback<EventFeed["pushToast"]>((kind, icon, title, detail) => {
    const id = idRef.current++;
    setToasts((ts) => [...ts, { id, kind, icon, title, detail }].slice(-3));
    const h = window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5200);
    timers.current.push(h);
  }, []);

  const pushEvent = useCallback<EventFeed["pushEvent"]>((kind, tag, ts, msg) => {
    setEvents((e) => {
      const next = [...e, { id: idRef.current++, ts, tag, kind, msg }];
      return next.length > 8 ? next.slice(next.length - 8) : next;
    });
  }, []);

  useEffect(() => () => timers.current.forEach((h) => clearTimeout(h)), []);

  return { toasts, events, pushToast, pushEvent };
}

/**
 * Watch the live metric stream and surface incidents into the feed: a boot line, traffic spikes,
 * SLO breaches, sustained churn, and scenario completion. Throttled so the feed reads as signal,
 * not noise. Purely derived from real server data — no synthetic events.
 */
export function useMetricEvents(
  observation: Observation | null,
  finished: boolean,
  scenario: string | null,
  feed: Pick<EventFeed, "pushToast" | "pushEvent">,
): void {
  const booted = useRef(false);
  const prevQueue = useRef(0);
  const prevArrivals = useRef(0);
  const last = useRef<{ spike: number; slo: number; churn: number }>({ spike: 0, slo: 0, churn: 0 });
  const wasFinished = useRef(false);
  const { pushToast, pushEvent } = feed;

  useEffect(() => {
    if (!observation) return;
    const m = observation.metrics;
    const ts = fmt.clock(m.t);

    if (!booted.current) {
      booted.current = true;
      prevQueue.current = m.queue_depth;
      pushEvent("info", "boot", ts, `session attached · scenario=${scenario ?? "—"}`);
      return; // skip detectors on the very first frame (no deltas yet)
    }

    const now = Date.now();
    const dQueue = m.queue_depth - prevQueue.current;
    const arrivals = Math.max(0, m.requests_completed + m.requests_churned + dQueue);

    if (arrivals > prevArrivals.current * 1.4 && arrivals > 60 && now - last.current.spike > 6000) {
      last.current.spike = now;
      pushToast("warn", "↯", "Traffic spike", `Incoming surged to ${Math.round(arrivals)} req/s`);
      pushEvent("warn", "traffic", ts, `spike → ${Math.round(arrivals)} req/s`);
    }
    if (m.slo_attainment < 0.9 && now - last.current.slo > 7000) {
      last.current.slo = now;
      pushToast("bad", "⚠", "SLO breach", `Attainment ${(m.slo_attainment * 100).toFixed(0)}% — scale up`);
      pushEvent("bad", "slo", ts, `attainment ${(m.slo_attainment * 100).toFixed(0)}% · p99 ${fmt.ms(m.ttft_p99)}`);
    }
    if (m.requests_churned > 0 && now - last.current.churn > 8000) {
      last.current.churn = now;
      pushEvent("warn", "churn", ts, `${m.requests_churned} request${m.requests_churned > 1 ? "s" : ""} gave up waiting`);
    }

    prevQueue.current = m.queue_depth;
    prevArrivals.current = arrivals;
  }, [observation, scenario, pushToast, pushEvent]);

  useEffect(() => {
    if (finished && !wasFinished.current && observation) {
      wasFinished.current = true;
      pushEvent("info", "ramp", fmt.clock(observation.metrics.t), "scenario complete");
    }
    if (!finished) wasFinished.current = false;
  }, [finished, observation, pushEvent]);
}
