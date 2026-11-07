import { proceduralVisuals } from "./ProceduralVisualRegistry";

/**
 * Single registration point for approved image-to-Three.js assets.
 * Put generated factories under ./models and register stable keys here.
 */
export function bootProceduralVisualManifest(): void {
  const keys = proceduralVisuals.keys();
  if (new URLSearchParams(location.search).get("dev") === "1" && keys.length > 0) {
    console.info("SLU procedural visuals", keys);
  }
}
