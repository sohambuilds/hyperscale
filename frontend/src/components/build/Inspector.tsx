import { COOLING_TIERS, CREWPOD, GPU_TIERS, GPU_TIER_ORDER, NETWORK_TIERS, POWER_TIERS, RACK_SLOTS } from "../../game/config";
import { builderInfo } from "../../game/engine";
import { fmt } from "../../format";
import type { GameState, GpuTierId, Placed, Policy } from "../../game/types";
import { Segmented } from "../mc/primitives";

interface InspectorProps {
  state: GameState;
  onInstall: (rackId: string) => void;
  onRemove: (rackId: string) => void;
  onPolicy: (rackId: string, policy: Policy) => void;
  onSetGpuType: (rackId: string, tier: GpuTierId) => void;
  onUpgradePower: (id: string) => void;
  onUpgradeCooling: (id: string) => void;
  onUpgradeNetwork: (id: string) => void;
  onSell: (id: string) => void;
}

export function Inspector(props: InspectorProps) {
  const { state } = props;
  const sel: Placed | undefined = state.placed.find((p) => p.id === state.selectedId);

  if (!sel) {
    return (
      <section className="panel inspector empty">
        <p className="inspector-hint">
          Pick a tool to build, or select a tile to inspect it. Start with <b>Power</b> →{" "}
          <b>Cooling</b> → <b>Rack</b>, then install GPUs.
        </p>
      </section>
    );
  }

  const building = sel.buildMs != null && sel.buildMs > 0;
  let body: React.ReactNode;
  if (sel.kind === "power") body = <UtilityInspector sel={sel} {...props} kind="power" />;
  else if (sel.kind === "cooling") body = <UtilityInspector sel={sel} {...props} kind="cooling" />;
  else if (sel.kind === "network") body = <NetworkInspector sel={sel} {...props} />;
  else if (sel.kind === "crewpod") body = <CrewPodInspector sel={sel} {...props} />;
  else body = <RackInspector sel={sel} {...props} />;

  return (
    <>
      {building && <div className="inspector-building ds-code">Under construction — a builder is on it.</div>}
      {body}
    </>
  );
}

function NetworkInspector({ sel, state, onUpgradeNetwork, onSell }: InspectorProps & { sel: Placed }) {
  const tier = sel.tier ?? 0;
  const cur = NETWORK_TIERS[tier];
  const nxt = NETWORK_TIERS[tier + 1];
  const cost = nxt ? nxt.capex - cur.capex : 0;
  const repLocked = nxt ? state.reputation < nxt.minRep : false;
  return (
    <section className="panel inspector">
      <header className="inspector-head">
        <h3 className="ds-title">{cur.name}</h3>
        <span className="ds-code">{cur.cap} req/s</span>
      </header>
      <p className="inspector-blurb">Uplink bandwidth — caps total requests served across the whole facility.</p>
      <div className="inspector-row">
        <span>rent</span>
        <span className="ds-num">{fmt.money(cur.rentPerMin)}/min</span>
      </div>
      {nxt ? (
        <div className="inspector-block">
          <span className="ds-label">upgrade</span>
          <p className="inspector-blurb">
            <b>{nxt.name}</b> — {nxt.cap} req/s of bandwidth.
          </p>
          <button type="button" className="btn primary sm" disabled={repLocked} onClick={() => onUpgradeNetwork(sel.id)}>
            {repLocked ? `Unlocks at reputation ${nxt.minRep}` : `Upgrade · ${fmt.money(cost)}`}
          </button>
        </div>
      ) : (
        <p className="inspector-blurb ds-code">Top tier installed.</p>
      )}
      <button type="button" className="btn danger" onClick={() => onSell(sel.id)}>
        Sell ({fmt.money(cur.capex * 0.5)} back)
      </button>
    </section>
  );
}

function CrewPodInspector({ sel, state, onSell }: InspectorProps & { sel: Placed }) {
  const b = builderInfo(state);
  return (
    <section className="panel inspector">
      <header className="inspector-head">
        <h3 className="ds-title">{CREWPOD.name}</h3>
        <span className="ds-code">+1 builder</span>
      </header>
      <p className="inspector-blurb">
        Houses a build crew. More builders means more buildings can go up at once — handy when you're
        expanding fast.
      </p>
      <div className="inspector-row">
        <span>build crew</span>
        <span className="ds-num">{b.total} total · {b.free} idle</span>
      </div>
      <div className="inspector-row">
        <span>rent</span>
        <span className="ds-num">{fmt.money(CREWPOD.rentPerMin)}/min</span>
      </div>
      <button type="button" className="btn danger" onClick={() => onSell(sel.id)}>
        Sell ({fmt.money(CREWPOD.capex * 0.5)} back)
      </button>
    </section>
  );
}

function UtilityInspector({
  sel,
  state,
  kind,
  onUpgradePower,
  onUpgradeCooling,
  onSell,
}: InspectorProps & { sel: Placed; kind: "power" | "cooling" }) {
  const tier = sel.tier ?? 0;
  const tiers = kind === "power" ? POWER_TIERS : COOLING_TIERS;
  const cur = tiers[tier];
  const nxt = tiers[tier + 1];
  const isCooling = kind === "cooling";
  const onUpgrade = kind === "power" ? onUpgradePower : onUpgradeCooling;
  const cap = isCooling ? `${(cur as (typeof COOLING_TIERS)[0]).kw} kW heat · PUE ${(cur as (typeof COOLING_TIERS)[0]).pue}` : `${(cur as (typeof POWER_TIERS)[0]).kw} kW power`;
  const cost = nxt ? nxt.capex - cur.capex : 0;
  const repLocked = nxt ? state.reputation < nxt.minRep : false;

  return (
    <section className="panel inspector">
      <header className="inspector-head">
        <h3 className="ds-title">{cur.name}</h3>
        <span className="ds-code">{cap}</span>
      </header>
      <div className="inspector-row">
        <span>rent</span>
        <span className="ds-num">{fmt.money(cur.rentPerMin)}/min</span>
      </div>
      {nxt ? (
        <div className="inspector-block">
          <span className="ds-label">upgrade</span>
          <p className="inspector-blurb">
            <b>{nxt.name}</b> — {isCooling ? `${(nxt as (typeof COOLING_TIERS)[0]).kw} kW heat, PUE ${(nxt as (typeof COOLING_TIERS)[0]).pue} (cheaper power)` : `${(nxt as (typeof POWER_TIERS)[0]).kw} kW power`}.
          </p>
          <button type="button" className="btn primary sm" disabled={repLocked} onClick={() => onUpgrade(sel.id)}>
            {repLocked ? `Unlocks at reputation ${nxt.minRep}` : `Upgrade · ${fmt.money(cost)}`}
          </button>
        </div>
      ) : (
        <p className="inspector-blurb ds-code">Top tier installed.</p>
      )}
      <button type="button" className="btn danger" onClick={() => onSell(sel.id)}>
        Sell ({fmt.money(cur.capex * 0.5)} back)
      </button>
    </section>
  );
}

function RackInspector({ sel, onInstall, onRemove, onPolicy, onSetGpuType, onSell }: InspectorProps & { sel: Placed }) {
  const gpus = sel.gpus ?? 0;
  const policy: Policy = sel.policy ?? "throughput";
  const tierId: GpuTierId = sel.gpuType ?? "h100";
  const t = GPU_TIERS[tierId];
  const perGpu = policy === "latency" ? t.latRps : t.thruRps;

  return (
    <section className="panel inspector">
      <header className="inspector-head">
        <h3 className="ds-title">Rack · {t.name}</h3>
        <span className="ds-code">
          {gpus}/{RACK_SLOTS} · {fmt.int(gpus * perGpu)} req/s
        </span>
      </header>

      <div className="inspector-block">
        <span className="ds-label">GPU tier {gpus > 0 ? "(empty to change)" : ""}</span>
        <Segmented<GpuTierId>
          options={GPU_TIER_ORDER.map((id) => ({ value: id, label: GPU_TIERS[id].name }))}
          value={tierId}
          readonly={gpus > 0}
          onChange={(v) => onSetGpuType(sel.id, v)}
        />
        <p className="inspector-blurb ds-code">
          {t.thruRps} thru / {t.latRps} lat req/s · {t.drawKw} kW · {fmt.money(t.capex)} + {fmt.money(t.rentPerMin)}/min
        </p>
      </div>

      <div className="inspector-block">
        <span className="ds-label">serving policy</span>
        <Segmented<Policy>
          options={[
            { value: "latency", label: "Latency" },
            { value: "throughput", label: "Throughput" },
          ]}
          value={policy}
          onChange={(p) => onPolicy(sel.id, p)}
        />
        <p className="inspector-blurb">
          {policy === "latency"
            ? "Small batches: meets strict SLAs, fewer req/s per GPU."
            : "Big batches: high req/s, worse tail — loose contracts only."}
        </p>
      </div>

      <div className="inspector-block">
        <span className="ds-label">GPU servers</span>
        <div className="gpu-controls">
          <button type="button" className="btn" onClick={() => onRemove(sel.id)} disabled={gpus <= 0}>
            − Remove
          </button>
          <span className="gpu-count ds-num">{gpus}</span>
          <button type="button" data-tut="build" className="btn" onClick={() => onInstall(sel.id)} disabled={gpus >= RACK_SLOTS}>
            + Install
          </button>
        </div>
      </div>

      <button type="button" className="btn danger" onClick={() => onSell(sel.id)}>
        Sell rack
      </button>
    </section>
  );
}
