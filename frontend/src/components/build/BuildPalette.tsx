import { PLACEABLES } from "../../game/config";
import { fmt } from "../../format";
import type { GameState, Tool } from "../../game/types";

interface PaletteItem {
  tool: Tool;
  label: string;
  capex?: number;
  hint: string;
}

const ITEMS: PaletteItem[] = [
  { tool: "cursor", label: "Select", hint: "Inspect a tile" },
  { tool: "power", label: PLACEABLES.power.label, capex: PLACEABLES.power.capex, hint: PLACEABLES.power.blurb },
  { tool: "cooling", label: PLACEABLES.cooling.label, capex: PLACEABLES.cooling.capex, hint: PLACEABLES.cooling.blurb },
  { tool: "rack", label: PLACEABLES.rack.label, capex: PLACEABLES.rack.capex, hint: PLACEABLES.rack.blurb },
  { tool: "sell", label: "Sell", hint: "Sell a tile for a partial refund" },
];

interface BuildPaletteProps {
  state: GameState;
  onSelectTool: (tool: Tool) => void;
}

export function BuildPalette({ state, onSelectTool }: BuildPaletteProps) {
  return (
    <div className="palette">
      {ITEMS.map((it) => {
        const tooPoor = it.capex != null && state.cash < it.capex;
        return (
          <button
            key={it.tool}
            type="button"
            data-tut={it.tool}
            className={"palette-btn" + (state.tool === it.tool ? " on" : "") + (tooPoor ? " poor" : "")}
            onClick={() => onSelectTool(it.tool)}
            title={it.hint}
          >
            <span className="palette-label">{it.label}</span>
            {it.capex != null && <span className="palette-cost ds-num">{fmt.money(it.capex)}</span>}
          </button>
        );
      })}
    </div>
  );
}
