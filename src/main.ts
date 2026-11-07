import { bootProceduralVisualManifest } from "./art/procedural/visualManifest";
import {
  createGameApp,
  createPuzzleAssembly,
  createThreeStarterAdapter,
  mountBrowserDevConsole
} from "@slu/web-shell";

const rendererAdapter = createThreeStarterAdapter(document.getElementById("game-canvas") as HTMLCanvasElement);

bootProceduralVisualManifest();

const app = await createGameApp({
  gameId: "tessera",
  gameName: "Tessera",
  version: "0.1.0",
  renderer: rendererAdapter,
  root: document.getElementById("ui")!,
  assemblies: [
    (shell) => createPuzzleAssembly({ shell })
  ]
});

if (new URLSearchParams(location.search).get("dev") === "1") {
  mountBrowserDevConsole(app.shell.studio.dev, { title: "Tessera DEV" });
}

console.log("SLU game ready", app);
