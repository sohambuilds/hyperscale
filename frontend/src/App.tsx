import { useState } from "react";

import { Controls } from "./components/Controls";
import { Dashboard } from "./components/Dashboard";
import { DatacenterFloor } from "./components/DatacenterFloor";
import { Results } from "./components/Results";
import { ServerDetail } from "./components/ServerDetail";
import { StatBar } from "./components/StatBar";
import { useSession } from "./useSession";

type Tab = "datacenter" | "telemetry";

export function App() {
  const session = useSession();
  const obs = session.observation;
  const [tab, setTab] = useState<Tab>("datacenter");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const instances = obs?.instances ?? [];
  const freeGpus = obs?.free_gpus ?? {};
  const totalFree = Object.values(freeGpus).reduce((a, b) => a + b, 0);
  // Show the explicitly selected rack, else default to the first instance so the panel is never
  // blank. Clicking the floor's empty/free area selects null and falls back here too.
  const selected =
    instances.find((i) => i.instance_id === selectedId) ?? instances[0] ?? null;

  return (
    <div className="app">
      <StatBar
        scenario={session.scenario}
        status={session.status}
        durationS={session.durationS}
        observation={obs}
      />
      {session.error && <div className="error-banner">⚠ {session.error}</div>}

      <nav className="tabs">
        <button
          className={"tab" + (tab === "datacenter" ? " active" : "")}
          onClick={() => setTab("datacenter")}
        >
          Datacenter
        </button>
        <button
          className={"tab" + (tab === "telemetry" ? " active" : "")}
          onClick={() => setTab("telemetry")}
        >
          Telemetry
        </button>
      </nav>

      {tab === "datacenter" ? (
        <div className="workspace">
          <DatacenterFloor
            instances={instances}
            freeGpus={freeGpus}
            selectedId={selected?.instance_id ?? null}
            onSelect={setSelectedId}
          />
          <ServerDetail
            instance={selected}
            catalog={session.catalog}
            totalFree={totalFree}
            finished={session.finished}
            controls={session.controls}
          />
        </div>
      ) : (
        <Dashboard history={session.history} />
      )}

      <Controls
        paused={session.paused}
        finished={session.finished}
        speed={session.speed}
        instances={instances}
        freeGpus={freeGpus}
        controls={session.controls}
      />
      {session.finished && session.score && (
        <Results scenario={session.scenario} score={session.score} />
      )}
    </div>
  );
}
