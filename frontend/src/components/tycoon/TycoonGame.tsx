// The RCT-style shell: the datacenter world fills the viewport and every control floats over it.
// No permanent side panel — Inspect/Contracts/Research slide in on demand. Panel CONTENT is the
// proven components from ../build/ (Inspector, ContractsBoard, ResearchPanel, EndModal,
// BuildPalette); this file owns layout, panel routing, and keyboard shortcuts.

import { useEffect, useMemo, useRef, useState } from "react";

import { computeStats } from "../../game/engine";
import { useTutorial } from "../../game/tutorial";
import { useGame } from "../../game/useGame";
import type { GameState } from "../../game/types";
import { ContractsBoard } from "../build/ContractsBoard";
import { EndModal } from "../build/EndModal";
import { Inspector } from "../build/Inspector";
import { ResearchPanel } from "../build/ResearchPanel";
import { BuildDock } from "./hud/BuildDock";
import { LevelUpBanner, useLevelUp } from "./hud/LevelUpBanner";
import { QuestTray } from "./hud/QuestTray";
import { TopBar, type PanelKind } from "./hud/TopBar";
import { TutorialCoach } from "./TutorialCoach";
import { WorldCanvas } from "./WorldCanvas";
import type { FrameData } from "./world/types";
import "./tycoon.css";

const PANEL_TITLES: Record<PanelKind, string> = {
  inspector: "Inspect",
  contracts: "Contracts",
  research: "Research",
};

function onboardingHint(s: GameState): string | null {
  if (!s.placed.some((p) => p.kind === "power")) return "① Build a Reactor — pick it below and click a tile.";
  if (!s.placed.some((p) => p.kind === "cooling")) return "② Raise a Cryo tower — GPUs make heat.";
  const racks = s.placed.filter((p) => p.kind === "rack");
  if (!racks.length) return "③ Place a Compute hub to hold GPUs.";
  if (racks.reduce((a, r) => a + (r.gpus ?? 0), 0) === 0) return "④ Select the hub, then Install GPU servers.";
  if (s.contracts.length === 0) return "⑤ Open Contracts (top right) and sign an offer.";
  if (s.paused) return "▶ Press play to open for business.";
  return null;
}

export function TycoonGame() {
  const g = useGame();
  const { state } = g;
  const tut = useTutorial(state);
  const stats = useMemo(() => computeStats(state), [state]);
  const { celebration, dismiss } = useLevelUp(state.reputation);

  // latest frame for the canvas loop (no React re-render needed on its side)
  const frameRef = useRef<FrameData>({ state, stats });
  frameRef.current = { state, stats };

  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [offersAttention, setOffersAttention] = useState(false);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const gameRef = useRef(g);
  gameRef.current = g;

  // selecting something in the world opens the inspector; clearing selection closes it
  useEffect(() => {
    if (state.selectedId) setPanel("inspector");
    else setPanel((p) => (p === "inspector" ? null : p));
  }, [state.selectedId]);

  // pulse the Contracts button when a new offer lands while the board is closed
  const prevOffers = useRef(state.offers.length);
  useEffect(() => {
    if (state.offers.length > prevOffers.current && panelRef.current !== "contracts") {
      setOffersAttention(true);
    }
    prevOffers.current = state.offers.length;
  }, [state.offers.length]);

  const togglePanel = (p: "contracts" | "research"): void => {
    if (p === "contracts") setOffersAttention(false);
    setPanel((cur) => {
      if (cur === p) return null;
      if (cur === "inspector") gameRef.current.selectId(null);
      return p;
    });
  };

  const closePanel = (): void => {
    if (panelRef.current === "inspector") gameRef.current.selectId(null);
    setPanel(null);
  };

  // keyboard: Esc closes/cancels · 1-5 tools · Space pause (kept inside the gesture for audio)
  useEffect(() => {
    const TOOL_KEYS = ["cursor", "power", "cooling", "rack", "network", "crewpod", "sell"] as const;
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const game = gameRef.current;
      const st = game.state;
      if (e.code === "Escape") {
        if (panelRef.current === "inspector") game.selectId(null);
        setPanel(null);
        game.setTool("cursor");
      } else if (e.code === "Space") {
        e.preventDefault();
        if (st.status === "playing") game.setPaused(!st.paused);
      } else if (/^Digit[1-7]$/.test(e.code)) {
        game.setTool(TOOL_KEYS[Number(e.code.slice(5)) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ticker = onboardingHint(state) ?? state.message;

  return (
    <div className={"tyc-root" + (panel ? " panel-open" : "")}>
      <WorldCanvas game={g} frameRef={frameRef} />

      <div className="tyc-topbar">
        <TopBar
          state={state}
          panel={panel}
          offersAttention={offersAttention}
          onPlayPause={() => g.setPaused(!state.paused)}
          onSpeed={g.setSpeed}
          onToggleMute={g.toggleMute}
          onReset={g.reset}
          onTutorial={tut.restart}
          onTogglePanel={togglePanel}
        />
      </div>

      {!tut.active && ticker && (
        <div className="tyc-ticker">
          <div className="game-ticker ds-code">{ticker}</div>
        </div>
      )}

      <div className="tyc-toolbar">
        <BuildDock state={state} onSelectTool={g.setTool} />
      </div>

      {!tut.active && (
        <div className="tyc-quests">
          <QuestTray state={state} onClaim={g.claimQuest} />
        </div>
      )}

      <LevelUpBanner celebration={celebration} dismiss={dismiss} />

      {panel && (
        <aside className="tyc-panel">
          <div className="tyc-panel-head">
            <span className="ds-title">{PANEL_TITLES[panel]}</span>
            <button type="button" className="icon-btn" onClick={closePanel} title="Close (Esc)" aria-label="Close panel">
              ✕
            </button>
          </div>
          <div className="tyc-panel-body">
            {panel === "inspector" && (
              <Inspector
                state={state}
                onInstall={g.installGpu}
                onRemove={g.removeGpu}
                onPolicy={g.setPolicy}
                onSetGpuType={g.setGpuType}
                onUpgradePower={g.upgradePower}
                onUpgradeCooling={g.upgradeCooling}
                onUpgradeNetwork={g.upgradeNetwork}
                onSell={g.sell}
              />
            )}
            {panel === "contracts" && <ContractsBoard state={state} onAccept={g.accept} onDecline={g.decline} />}
            {panel === "research" && <ResearchPanel state={state} onResearch={g.research} />}
          </div>
        </aside>
      )}

      <EndModal state={state} onReset={g.reset} onContinue={g.continueRun} />
      <TutorialCoach tut={tut} panel={panel} selectedId={state.selectedId} />
    </div>
  );
}
