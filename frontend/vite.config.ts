import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server (5173) talks to the sim server's WebSocket at ws://localhost:8000/ws.
// Override with VITE_WS_URL if the backend lives elsewhere.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
