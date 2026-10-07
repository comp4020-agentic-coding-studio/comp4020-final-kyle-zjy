import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The client is a static build served by the Node server (src/server/http.ts).
// In dev, Vite serves it and forwards the API and socket to the server on 8080.
export default defineConfig({
  root: "src/client",
  publicDir: "../../public",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../../dist/client", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/readme": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
});
