import { TycoonGame } from "./components/tycoon/TycoonGame";

// The game is a datacenter construction tycoon (see docs/BUILDER.md), rendered as a full-viewport
// isometric world with a floating RCT-style HUD (components/tycoon). The earlier boxed layout
// (components/build) and the Mission Control dashboard (components/mc) are kept for reference —
// tycoon/ reuses build/'s panel components directly.
export function App() {
  return <TycoonGame />;
}
