/**
 * Edge-pivot roll kinematics (GDD §10 Roll, §29.2): rotate about the leading bottom edge; the centre's apex is
 * √2/2 × tile above the floor at 45°. Re-derived here (no prototype code). Pure — unit tested.
 * The cube rolls toward −z. `half` = half the tile in world units (1.0 for a 2.0-unit tile).
 */
export interface RollPose {
  /** Centre offset from the origin-cell centre (world units). */
  y: number;
  z: number;
  /** Rotation about the x-axis (radians). */
  angle: number;
}

export function rollPose(t: number, half: number): RollPose {
  const u = Math.max(0, Math.min(1, t));
  // ease the roll: slow tip-over, heavier landing
  const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const theta = e * (Math.PI / 2);
  // centre relative to pivot (leading bottom edge at z = −half, y = 0): v = (y: half, z: +half), rotated by −theta
  const vy = half * Math.cos(theta) + half * Math.sin(theta);
  const vz = -half * Math.sin(theta) + half * Math.cos(theta);
  return { y: vy, z: -half + vz, angle: -theta };
}

/** Lowest vertex height of a cube of half-size `half` rotated by `angle` with centre height `y`. */
export function lowestVertex(y: number, angle: number, half: number): number {
  let min = Infinity;
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const vy = sy * half * Math.cos(angle) - sz * half * Math.sin(angle);
    min = Math.min(min, y + vy);
  }
  return min;
}
