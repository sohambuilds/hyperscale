import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server (5173) talks to the sim server's WebSocket at ws://localhost:8000/ws.
// Override with VITE_WS_URL if the backend lives elsewhere.
// PORT env (set by preview tooling) wins; 5173 stays the default for manual runs.
// (typed via globalThis so we don't need @types/node for one lookup)
const envPort = Number(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PORT,
);

export default defineConfig({
  plugins: [react()],
  server: { port: envPort || 5173 },
});
