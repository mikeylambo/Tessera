import { defineConfig } from "vite";
import { sluTuning } from "@slu/web-shell/look/vite";

export default defineConfig({
  base: "./",
  // dev-server only: backs the tuning panel's Save / Save As / Load (writes tuning/*.json)
  plugins: [sluTuning()],
  build: { target: "es2022", chunkSizeWarningLimit: 1400 },
  test: { include: ["tests/**/*.test.ts"], environment: "node" }
} as never);
