/**
 * Vite dev-server plugin backing the tuning panel's Save / Save As / Load.
 * Writes `tuning/<group>[.<variant>].json` into the game repo. Dev-server only (apply: "serve").
 *
 *   import { sluTuning } from "@slu/web-shell/look/vite";
 *   export default defineConfig({ plugins: [sluTuning()] });
 */
export interface SluTuningPluginOptions {
    dir?: string;
    route?: string;
}
export declare function sluTuning(options?: SluTuningPluginOptions): {
    name: string;
    apply: "serve";
    configureServer(server: any): Promise<void>;
};
