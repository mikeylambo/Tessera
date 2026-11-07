import { DeterministicRngRegistry } from "@slu/web-shell";

/** Seeded RNG streams — sim only (GDD §29.3 principle 8). Lifted from the shell's DeterministicRngRegistry. */
export type RngStream = "formations" | "mirror" | "beacons" | "rewards" | "runes" | "skyfall" | "bot";
export const RNG_STREAMS: readonly RngStream[] = ["formations", "mirror", "beacons", "rewards", "runes", "skyfall", "bot"];

export function createRng(seed: number | string): DeterministicRngRegistry<RngStream> {
  const r = new DeterministicRngRegistry<RngStream>(RNG_STREAMS);
  r.init(seed);
  return r;
}
