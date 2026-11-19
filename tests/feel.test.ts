import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TESSERA_BUNDLES, FEEL_EVENT_BUNDLES } from "../src/render/three/Feel";

const canon = JSON.parse(readFileSync("tuning/tessera.feel.json", "utf8")) as { values: Record<string, number> };

describe("detonation feel", () => {
  it("every feel event resolves to a defined impact bundle (or null by design)", () => {
    const ids = new Set(TESSERA_BUNDLES.map((b) => b.id));
    for (const [ev, id] of Object.entries(FEEL_EVENT_BUNDLES)) {
      if (id !== null) expect(ids.has(id), `${ev} → ${id}`).toBe(true);
    }
    expect(FEEL_EVENT_BUNDLES.Miss).toBeNull();
  });
  it("hit-stop canon: 3 f base, +1 per chain kill, capped at 6", () => {
    expect(canon.values.hitBase).toBe(3);
    expect(canon.values.hitPerChain).toBe(1);
    expect(canon.values.hitCap).toBe(6);
  });
  it("shard count 6–10, cell flash 4 f, mobile kill vibration 10 ms", () => {
    expect(canon.values.shardsMin).toBe(6);
    expect(canon.values.shardsMax).toBe(10);
    expect(canon.values.cellFlashFrames).toBe(4);
    expect(canon.values.vibrateKillMs).toBe(10);
  });
  it("Blast rumble is a strong 150 ms pulse", () => {
    const b = TESSERA_BUNDLES.find((x) => x.id === "tessera.climax")!;
    expect(b.rumble).toEqual({ strength: 1, ms: 150 });
  });
});
