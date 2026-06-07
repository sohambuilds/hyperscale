import { InfoTooltip } from "../InfoTooltip";
import type { Session } from "../../useSession";
import { NEUTRAL_STRAINS, deriveStrains } from "../../mission";
import type { EventFeed } from "./hooks";
import { useEasedStrains } from "./hooks";
import { HardTriangle } from "./viz";
import { VitalsGrid } from "./Vitals";
import { ServingConfig } from "./ServingConfig";
import { EventLog } from "./Feed";

interface MissionControlProps {
  session: Session;
  feed: EventFeed;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
}

/**
 * Mission Control — the main dashboard. Left: the hard triangle as hero plus the live vitals.
 * Right: the serving-config panel and the terminal event log. Everything is driven by the live
 * session (the WebSocket sim), with the triangle leaning on an eased spring toward real strain.
 */
export function MissionControl({ session, feed, advanced, setAdvanced }: MissionControlProps) {
  const obs = session.observation;
  const m = obs?.metrics ?? null;
  const instances = obs?.instances ?? [];
  const totalFree = Object.values(obs?.free_gpus ?? {}).reduce((a, b) => a + b, 0);
  const instance = instances[0] ?? null;

  const target = m ? deriveStrains(m) : NEUTRAL_STRAINS;
  const strains = useEasedStrains(target);

  return (
    <div className="mc-grid">
      <main className="mc-left">
        <section className="panel hero">
          <div className="hero-head">
            <h2 className="ds-h2">
              <InfoTooltip term="triangle">The hard triangle</InfoTooltip>
            </h2>
            <p className="hero-sub">Push one corner — the other two strain.</p>
          </div>
          <HardTriangle strains={strains} size={340} />
        </section>

        {m ? (
          <VitalsGrid m={m} history={session.history} />
        ) : (
          <section className="panel hero">
            <p className="hero-sub">Waiting for telemetry — connect the simulation server to see live vitals.</p>
          </section>
        )}
      </main>

      <aside className="mc-right">
        <ServingConfig
          instance={instance}
          catalog={session.catalog}
          totalFree={totalFree}
          finished={session.finished}
          advanced={advanced}
          setAdvanced={setAdvanced}
          onSetGpu={session.controls.setGpuCount}
          feed={feed}
          t={m?.t ?? 0}
        />
        <EventLog events={feed.events} />
      </aside>
    </div>
  );
}
