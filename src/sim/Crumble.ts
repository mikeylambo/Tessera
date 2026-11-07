import { TUNING, crumbleIntervalForSector } from "../data/tuning";

/** Owner of the Crumble timer and the ground-economy weight (GDD §6). */
export class Crumble {
  /** Ticks since the last timed crumble. */
  counter = 0;
  enabled = true;
  /** Fixed interval override (Hundred stages); 0 = derive from sector. */
  fixed = 0;
  warned = false;
  /** Contact has happened (timer may run). See TUNING.crumble.holdUntilContact. */
  contacted = true;

  reset(fixed = 0, enabled = true): void {
    this.counter = 0;
    this.fixed = fixed;
    this.enabled = enabled;
    this.warned = false;
    this.contacted = true;
  }

  /** Interval in ticks: sector base (+Slow Earth) − sprawl weight, floored. */
  interval(sector: number, tilesBehind: number, slowEarth: number): number {
    const base = (this.fixed > 0 ? this.fixed : crumbleIntervalForSector(sector)) + 2 * slowEarth;
    const over = Math.max(0, tilesBehind - TUNING.economy.weightBase);
    const weight = Math.floor(over / TUNING.economy.weightPer);
    return Math.max(TUNING.economy.weightMinInterval, base - weight);
  }

  serialize(): string {
    return `${this.counter},${this.enabled ? 1 : 0},${this.fixed},${this.warned ? 1 : 0},${this.contacted ? 1 : 0}`;
  }
}
