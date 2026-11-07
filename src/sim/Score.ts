import type { EventQueue } from "./Events";

/** Owner of score, depth, chain (GDD §30). Every point is an event, so the total is auditable. */
export class Score {
  total = 0;
  bestChain = 0;
  /** Sum of all Score events emitted — invariant: equals total. */
  ledger = 0;
  multiplier = 1;

  reset(): void {
    this.total = 0;
    this.bestChain = 0;
    this.ledger = 0;
    this.multiplier = 1;
  }

  add(base: number, reason: string, events: EventQueue, applyMul = true): number {
    const amount = Math.round(base * (applyMul ? this.multiplier : 1));
    if (amount === 0) return 0;
    this.total += amount;
    this.ledger += amount;
    events.push({ t: "Score", amount, total: this.total, reason });
    return amount;
  }

  serialize(): string {
    return `${this.total},${this.bestChain}`;
  }
}
