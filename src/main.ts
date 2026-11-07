import "@fontsource/cinzel/400.css";
import "@fontsource/jetbrains-mono/400.css";
import { SLUWebShell, ThreeAdapter, mountBrowserDevConsole } from "@slu/web-shell";
import { bootProceduralVisualManifest } from "./art/procedural/visualManifest";
import { Game, readFlags } from "./game/Game";
import { installGameApi } from "./dev/gameApi";
import { loadTuningCanon, tunables } from "@slu/web-shell/tuning";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui")!;
const flags = readFlags(location.search);

// shipped tuning canon (tuning/*.json) — presentation values only; sim numbers live in data/tuning.ts
loadTuningCanon(import.meta.glob("/tuning/*.json", { eager: true }), tunables);
bootProceduralVisualManifest();
const game = new Game(canvas, uiRoot, flags);

// The shell owns session phase, telemetry and the dev console; Tessera's renderer sits behind its Three adapter seam.
const shell = new SLUWebShell({
  build: { gameId: "tessera", gameName: "Tessera", version: "0.1.0" },
  renderer: new ThreeAdapter({
    onSuspend: () => game.pause(),
    onScreenshot: () => new Promise((resolve) => canvas.toBlob(resolve))
  }),
  settings: game.profile.settings
});
shell.studio.dev.register("tessera.state", { description: "Tessera sim state", run: () => JSON.stringify((window as unknown as { __GAME: { state: () => unknown } }).__GAME.state(), null, 2) });

installGameApi(game);
await shell.boot();
await game.boot();
const q = new URLSearchParams(location.search);
if (q.get("dev") === "1") mountBrowserDevConsole(shell.studio.dev, { title: "TESSERA DEV" });
if (q.get("dev") === "1" || q.has("tune")) {
  // lazy import keeps the panel out of the production bundle's critical path
  void import("@slu/web-shell/tuning/panel").then(({ mountTuningPanel }) => {
    const palette = game.view.scene.look.palette;
    const panel = mountTuningPanel({ registry: tunables, resolveColor: (v) => palette.resolve(v), colorTokens: () => palette.tokens(), startOpen: q.has("tune") });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") panel.toggle();
    });
  });
}
console.info("Tessera ready");
