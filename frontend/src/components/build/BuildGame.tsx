import { useGame } from "../../game/useGame";
import { useTutorial } from "../../game/tutorial";
import type { GameState } from "../../game/types";
import { BuildView } from "./BuildView";
import { BuildPalette } from "./BuildPalette";
import { GameTopBar } from "./GameTopBar";
import { MeterStrip } from "./MeterStrip";
import { RightPanel } from "./RightPanel";
import { EndModal } from "./EndModal";
import { Tutorial } from "./Tutorial";

function onboardingHint(s: GameState): string | null {
  if (!s.placed.some((p) => p.kind === "power")) return "① Pick Power below and click a tile to build it.";
  if (!s.placed.some((p) => p.kind === "cooling")) return "② Add a Cooling unit — GPUs make heat.";
  const racks = s.placed.filter((p) => p.kind === "rack");
  if (!racks.length) return "③ Place a Server rack to hold GPUs.";
  if (racks.reduce((a, r) => a + (r.gpus ?? 0), 0) === 0) return "④ Select the rack, then Install GPU servers.";
  if (s.contracts.length === 0) return "⑤ Open the Contracts tab and sign an offer.";
  if (s.paused) return "▶ Press play to open for business.";
  return null;
}

/** The datacenter construction tycoon. */
export function BuildGame() {
  const g = useGame();
  const { state } = g;
  const tut = useTutorial(state);
  const strained = state.contracts.some((c) => c.status === "breaching");
  const ticker = onboardingHint(state) ?? state.message;

  return (
    <div className={"game" + (strained ? " strained" : "")}>
      <GameTopBar
        state={state}
        onPlayPause={() => g.setPaused(!state.paused)}
        onSpeed={g.setSpeed}
        onToggleMute={g.toggleMute}
        onReset={g.reset}
        onTutorial={tut.restart}
      />

      <MeterStrip state={state} />

      {!tut.active && ticker && <div className="game-ticker ds-code">{ticker}</div>}

      <div className="game-body">
        <main className="game-main">
          <BuildView state={state} onTapTile={g.tapTile} />
          <BuildPalette state={state} onSelectTool={g.setTool} />
        </main>
        <RightPanel game={g} />
      </div>

      <EndModal state={state} onReset={g.reset} onContinue={g.continueRun} />
      <Tutorial tut={tut} />
    </div>
  );
}
