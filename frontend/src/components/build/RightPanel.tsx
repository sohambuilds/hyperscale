import { useEffect, useState } from "react";

import { TECHS } from "../../game/config";
import { techLock } from "../../game/engine";
import type { Game } from "../../game/useGame";
import { ContractsBoard } from "./ContractsBoard";
import { Inspector } from "./Inspector";
import { ResearchPanel } from "./ResearchPanel";

type Tab = "inspect" | "contracts" | "research";

export function RightPanel({ game }: { game: Game }) {
  const { state } = game;
  const [tab, setTab] = useState<Tab>("inspect");

  // jump to the inspector whenever the player selects a tile
  useEffect(() => {
    if (state.selectedId) setTab("inspect");
  }, [state.selectedId]);

  const offerCount = state.offers.length;
  const researchable = TECHS.filter((t) => techLock(state, t) === null).length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "inspect", label: "Inspect" },
    { id: "contracts", label: "Contracts", badge: offerCount || undefined },
    { id: "research", label: "Research", badge: researchable || undefined },
  ];

  return (
    <aside className="rightpanel">
      <div className="rp-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" data-tut={`${t.id}-tab`} className={"rp-tab" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge ? <span className="rp-badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="rp-body">
        {tab === "inspect" && (
          <Inspector
            state={state}
            onInstall={game.installGpu}
            onRemove={game.removeGpu}
            onPolicy={game.setPolicy}
            onSetGpuType={game.setGpuType}
            onUpgradePower={game.upgradePower}
            onUpgradeCooling={game.upgradeCooling}
            onUpgradeNetwork={game.upgradeNetwork}
            onSell={game.sell}
          />
        )}
        {tab === "contracts" && <ContractsBoard state={state} onAccept={game.accept} onDecline={game.decline} />}
        {tab === "research" && <ResearchPanel state={state} onResearch={game.research} />}
      </div>
    </aside>
  );
}
