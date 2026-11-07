import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { TUNING } from "../src/data/tuning";

const canon = (g: string) => JSON.parse(readFileSync(`tuning/${g}.json`, "utf8")) as { group: string; values: Record<string, unknown> };

describe("tuning canon (presentation values)", () => {
  it("every canon file names its own group", () => {
    for (const f of readdirSync("tuning").filter((x) => x.endsWith(".json"))) expect(canon(f.replace(/\.json$/, "")).group).toBe(f.replace(/\.json$/, ""));
  });
  it("camera canon reproduces GDD §15 geometry (12 back, 14 up, 6 ahead, FOV 50, 0.12 s damping)", () => {
    const v = canon("feel.camera.springArm").values;
    const c = TUNING.camera;
    expect(v.distance as number).toBeCloseTo(Math.hypot(c.back + c.ahead, c.up), 2);
    expect(v.fov).toBe(c.fov);
    expect(v.lag as number).toBeCloseTo(1 / c.damping, 1);
    expect(v.height).toBe(0);
  });
  it("shake canon respects the 0.4-unit maximum (GDD §15)", () => {
    expect(canon("feel.shake").values.maxTranslate as number).toBeLessThanOrEqual(0.4);
  });
  it("post canon follows the §23 recipe: bloom threshold 0.85, no grain, no base chromatic aberration", () => {
    const v = canon("look.post").values;
    expect(v.bloomThreshold).toBe(0.85);
    expect(v.grain).toBe(false);
    expect(v.chromatic).toBe(false);
  });
});
