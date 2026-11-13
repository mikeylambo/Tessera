import { tunables as defaultRegistry } from "../tuning/Tunables.js";
import { perlin1 } from "./noise.js";
/**
 * Trauma shake: amount = trauma², sampled from Perlin noise on six channels, with linear decay.
 * Scaled by the accessibility screen-shake setting (0 disables it entirely).
 */
export class TraumaShake {
    tune;
    trauma = 0;
    /** Accessibility multiplier (settings.screenShake). */
    scale = 1;
    offset = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
    t = 0;
    constructor(registry = defaultRegistry, group = "feel.shake") {
        this.tune = registry.define(group, {
            maxTranslate: { min: 0, max: 2, step: 0.01, default: 0.35 }, maxRotateDeg: { min: 0, max: 15, step: 0.1, default: 3 },
            frequency: { min: 1, max: 60, step: 0.5, default: 22 }, decay: { min: 0.1, max: 5, step: 0.05, default: 1.6 },
            exponent: { min: 1, max: 3, step: 0.1, default: 2 }
        });
    }
    add(amount) { this.trauma = Math.min(1, this.trauma + Math.max(0, amount)); }
    update(dt) {
        this.t += dt;
        this.trauma = Math.max(0, this.trauma - this.tune.decay * dt);
        const amt = Math.pow(this.trauma, this.tune.exponent) * Math.max(0, this.scale);
        const f = this.tune.frequency * this.t;
        const tr = this.tune.maxTranslate * amt;
        const rot = (this.tune.maxRotateDeg * Math.PI / 180) * amt;
        const o = this.offset;
        o.x = tr * perlin1(f + 11.1);
        o.y = tr * perlin1(f + 37.7);
        o.z = tr * 0.5 * perlin1(f + 63.3);
        o.pitch = rot * perlin1(f + 91.9);
        o.yaw = rot * perlin1(f + 117.2);
        o.roll = rot * perlin1(f + 151.5);
        return o;
    }
}
