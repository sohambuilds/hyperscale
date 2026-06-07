import { BuildGame } from "./components/build/BuildGame";

// The game is a datacenter construction tycoon (see docs/BUILDER.md). The earlier Mission Control
// dashboard lives under components/mc/ but is no longer wired in — kept for reference/reuse.
export function App() {
  return <BuildGame />;
}
