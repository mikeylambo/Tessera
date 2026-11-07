import { describe, expect, it } from "vitest";
import { rollPose, lowestVertex } from "../src/render/rollMath";

describe("edge-pivot roll kinematics", () => {
  const half = 1;
  it("starts on its cell and lands exactly one cell forward (−z)", () => {
    const a = rollPose(0, half);
    const b = rollPose(1, half);
    expect(a.y).toBeCloseTo(half);
    expect(a.z).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(half);
    expect(b.z).toBeCloseTo(-2 * half);
    expect(b.angle).toBeCloseTo(-Math.PI / 2);
  });
  it("apex is √2/2 × tile above the floor", () => {
    expect(rollPose(0.5, half).y).toBeCloseTo(Math.SQRT2 * half, 5);
  });
  it("never intersects the floor", () => {
    for (let i = 0; i <= 200; i++) {
      const p = rollPose(i / 200, half);
      expect(lowestVertex(p.y, p.angle, half)).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});
