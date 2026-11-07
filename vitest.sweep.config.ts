import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tools/sweep/**/*.sweep.ts"], environment: "node", testTimeout: 900000 } });
