import "@fontsource/cinzel/400.css";
import "@fontsource/jetbrains-mono/400.css";
import { SLUWebShell, ThreeAdapter, mountBrowserDevConsole } from "@slu/web-shell";
import { bootProceduralVisualManifest } from "./art/procedural/visualManifest";
import { Game, readFlags } from "./game/Game";
import { installGameApi } from "./dev/gameApi";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui")!;
const flags = readFlags(location.search);

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
if (new URLSearchParams(location.search).get("dev") === "1") mountBrowserDevConsole(shell.studio.dev, { title: "TESSERA DEV" });
console.info("Tessera ready");
