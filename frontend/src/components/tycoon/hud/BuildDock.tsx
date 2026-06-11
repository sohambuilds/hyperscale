// The build dock — tool CARDS (icon, name, mono cost, key hint) replacing the text palette.
// Keeps the [data-tut] anchors the tutorial highlights and shows the shortfall when a tool is
// unaffordable instead of just greying out.

import { PLACEABLES } from "../../../game/config";
import { fmt } from "../../../format";
import type { GameState, Tool } from "../../../game/types";
import { IconBolt, IconCursor, IconFan, IconHardHat, IconRack, IconSell, IconSwitch } from "./icons";

interface DockItem {
  tool: Tool;
  label: string;
  icon: React.ReactNode;
  capex?: number;
  hint: string;
  key: string;
}

const ITEMS: DockItem[] = [
  { tool: "cursor", label: "Select", icon: <IconCursor size={17} />, hint: "Inspect a tile", key: "1" },
  { tool: "power", label: "Reactor", icon: <IconBolt size={17} />, capex: PLACEABLES.power.capex, hint: PLACEABLES.power.blurb, key: "2" },
  { tool: "cooling", label: "Cryo", icon: <IconFan size={17} />, capex: PLACEABLES.cooling.capex, hint: PLACEABLES.cooling.blurb, key: "3" },
  { tool: "rack", label: "Compute", icon: <IconRack size={17} />, capex: PLACEABLES.rack.capex, hint: PLACEABLES.rack.blurb, key: "4" },
  { tool: "network", label: "Relay", icon: <IconSwitch size={17} />, capex: PLACEABLES.network.capex, hint: PLACEABLES.network.blurb, key: "5" },
  { tool: "crewpod", label: "Crew", icon: <IconHardHat size={17} />, capex: PLACEABLES.crewpod.capex, hint: PLACEABLES.crewpod.blurb, key: "6" },
  { tool: "sell", label: "Sell", icon: <IconSell size={17} />, hint: "Sell a tile for a partial refund", key: "7" },
];

/** Identity color per tool — mirrors the canvas sprites (reactor gold, cryo teal, relay magenta…). */
const ACCENT: Record<Tool, string> = {
  cursor: "var(--c-cyan)",
  power: "var(--c-orange)",
  cooling: "var(--c-teal)",
  rack: "var(--c-blue)",
  network: "var(--c-magenta)",
  crewpod: "var(--c-gold)",
  sell: "var(--c-red)",
};

export function BuildDock({ state, onSelectTool }: { state: GameState; onSelectTool: (t: Tool) => void }) {
  return (
    <div className="dock">
      {ITEMS.map((it) => {
        const short = it.capex != null ? Math.max(0, it.capex - state.cash) : 0;
        const poor = short > 0;
        return (
          <button
            key={it.tool}
            type="button"
            data-tut={it.tool}
            className={"dock-card" + (state.tool === it.tool ? " on" : "") + (poor ? " poor" : "")}
            style={{ "--ta": ACCENT[it.tool] } as React.CSSProperties}
            onClick={() => onSelectTool(it.tool)}
            title={poor ? `${it.hint} (need ${fmt.money(short)} more)` : it.hint}
          >
            <span className="dock-icon">{it.icon}</span>
            <span className="dock-label">{it.label}</span>
            {it.capex != null && (
              <span className={"dock-cost ds-num" + (poor ? " is-bad" : "")}>
                {poor ? `−${fmt.money(short)}` : fmt.money(it.capex)}
              </span>
            )}
            <span className="dock-key ds-code">{it.key}</span>
          </button>
        );
      })}
    </div>
  );
}
