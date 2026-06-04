import { useCallback, useEffect, useRef, useState } from "react";

import { sendControl, wsUrl } from "./api/ws";
import type { Catalog, Metrics, Observation, Score, ServerMsg } from "./types";

const HISTORY_MAX = 1200; // ~20 min of 1 Hz ticks; plenty for the 10-min ramp

export type ConnStatus = "connecting" | "open" | "closed";

export interface SessionControls {
  play: () => void;
  pause: () => void;
  step: () => void;
  setSpeed: (speed: number) => void;
  setGpuCount: (instanceId: string, count: number) => void;
}

export interface Session {
  status: ConnStatus;
  scenario: string | null;
  durationS: number | null;
  tickSeconds: number;
  paused: boolean;
  speed: number;
  finished: boolean;
  observation: Observation | null;
  catalog: Catalog | null;
  history: Metrics[];
  score: Score | null;
  error: string | null;
  controls: SessionControls;
}

export function useSession(): Session {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [scenario, setScenario] = useState<string | null>(null);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [tickSeconds, setTickSeconds] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(true);
  const [speed, setSpeedState] = useState<number>(1);
  const [finished, setFinished] = useState<boolean>(false);
  const [observation, setObservation] = useState<Observation | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [history, setHistory] = useState<Metrics[]>([]);
  const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("closed");
    ws.onmessage = (ev: MessageEvent<string>) => {
      const msg = JSON.parse(ev.data) as ServerMsg;
      switch (msg.type) {
        case "init":
          setScenario(msg.scenario);
          setDurationS(msg.duration_s);
          setTickSeconds(msg.tick_seconds);
          setPaused(msg.paused);
          setSpeedState(msg.speed);
          setObservation(msg.observation);
          setCatalog(msg.catalog);
          setHistory([msg.observation.metrics]);
          setFinished(false);
          setScore(null);
          break;
        case "tick":
          setObservation(msg.observation);
          setHistory((h) => {
            const next = h.concat(msg.observation.metrics);
            return next.length > HISTORY_MAX ? next.slice(next.length - HISTORY_MAX) : next;
          });
          break;
        case "done":
          setObservation(msg.observation);
          setHistory((h) => h.concat(msg.observation.metrics));
          setScore(msg.score);
          setFinished(true);
          setPaused(true);
          break;
        case "error":
          setError(msg.error);
          break;
      }
    };

    return () => {
      ws.onmessage = null;
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const play = useCallback(() => {
    sendControl(wsRef.current, { type: "resume" });
    setPaused(false);
  }, []);

  const pause = useCallback(() => {
    sendControl(wsRef.current, { type: "pause" });
    setPaused(true);
  }, []);

  const step = useCallback(() => {
    sendControl(wsRef.current, { type: "step" });
  }, []);

  const setSpeed = useCallback((s: number) => {
    sendControl(wsRef.current, { type: "set_speed", speed: s });
    setSpeedState(s);
  }, []);

  const setGpuCount = useCallback((instanceId: string, count: number) => {
    sendControl(wsRef.current, { type: "set_gpu_count", instance_id: instanceId, count });
  }, []);

  return {
    status,
    scenario,
    durationS,
    tickSeconds,
    paused,
    speed,
    finished,
    observation,
    catalog,
    history,
    score,
    error,
    controls: { play, pause, step, setSpeed, setGpuCount },
  };
}
