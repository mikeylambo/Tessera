/** Cosmetic randomness only (never gameplay): particle jitter, dust, distant silhouettes. */
export const cosmetic = {
  rand: (): number => Math.random(),
  range: (a: number, b: number): number => a + Math.random() * (b - a),
  sign: (): number => (Math.random() < 0.5 ? -1 : 1)
};

/** Tiny seeded PRNG for procedural textures (stable per type across boots). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
