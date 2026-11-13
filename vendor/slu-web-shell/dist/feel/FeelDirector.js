import { ImpactPlayer } from "../impact/ImpactPlayer.js";
import { tunables as defaultRegistry } from "../tuning/Tunables.js";
import { TimeControl } from "./TimeControl.js";
import { TraumaShake } from "./TraumaShake.js";
import { Rumble } from "./Rumble.js";
export const SLU_IMPACT_BUNDLES = [
    { id: "hit.light", hitstopMs: 35, trauma: 0.18, vfx: [{ id: "fx.impact.burst", scale: 0.6 }], post: [{ id: "chromatic.hit", amount: 0.25 }], audio: "combat.hit.light", rumble: { strength: 0.25, ms: 60 } },
    { id: "hit.heavy", hitstopMs: 90, trauma: 0.45, vfx: [{ id: "fx.impact.burst", scale: 1.2 }, { id: "fx.shockwave.ring", scale: 0.5 }], post: [{ id: "chromatic.hit", amount: 0.7 }, { id: "bloom.flare", amount: 0.5 }], audio: "combat.hit.heavy", rumble: { strength: 0.7, ms: 140 }, flash: { token: "ember.hot", amount: 0.12 } },
    { id: "hit.crit", hitstopMs: 140, trauma: 0.6, slowmo: { scale: 0.25, ms: 380, easing: "easeIn" }, vfx: [{ id: "fx.impact.burst", scale: 1.6 }, { id: "fx.shockwave.ring", scale: 0.8 }, { id: "fx.lightning.arc", scale: 0.6 }], post: [{ id: "chromatic.hit", amount: 1 }, { id: "bloom.flare", amount: 1 }, { id: "vignette.squeeze", amount: 0.6 }], audio: "combat.hit.crit", rumble: { strength: 1, ms: 220 }, flash: { token: "highlight", amount: 0.22 } },
    { id: "explosion.large", hitstopMs: 60, trauma: 0.8, vfx: [{ id: "fx.explosion", scale: 1.4 }, { id: "fx.shockwave.ring", scale: 1.2 }, { id: "fx.smoke.puff", scale: 1.5, at: 0.15 }], post: [{ id: "bloom.flare", amount: 1 }, { id: "chromatic.hit", amount: 0.5 }], audio: "world.explosion.large", rumble: { strength: 1, ms: 400 }, flash: { token: "ember", amount: 0.25 } },
    { id: "player.hurt", hitstopMs: 70, trauma: 0.5, post: [{ id: "vignette.squeeze", amount: 1 }, { id: "chromatic.hit", amount: 0.6 }], audio: "player.hurt", rumble: { strength: 0.8, ms: 200 }, flash: { token: "danger", amount: 0.18 } },
    { id: "land.hard", trauma: 0.25, vfx: [{ id: "fx.smoke.puff", scale: 0.8 }, { id: "fx.shockwave.ring", scale: 0.35 }], audio: "player.land.hard", rumble: { strength: 0.4, ms: 90 } }
];
/**
 * Game-feel kit facade: hitstop, slow-mo, trauma shake, rumble, screen flash and impact bundles,
 * built on the salvaged ImpactPlayer so cues stay timeline-driven and deterministic.
 */
export class FeelDirector {
    sinks;
    time;
    shake;
    rumbler;
    player;
    bundles = new Map();
    tuned = new Map();
    ctx = new Map();
    accessibility = { screenShake: 1, flashes: 1, vibration: true, reducedMotion: false };
    constructor(sinks = {}, options = {}) {
        this.sinks = sinks;
        const registry = options.registry ?? defaultRegistry;
        this.time = new TimeControl(options.speed);
        this.shake = new TraumaShake(registry);
        this.rumbler = new Rumble();
        this.player = new ImpactPlayer({ onCue: (id, recipe, cue, context) => this.dispatch(id, recipe, cue, context), onComplete: (id) => this.ctx.delete(id) });
        for (const b of options.bundles ?? SLU_IMPACT_BUNDLES)
            this.define(b, registry);
    }
    /** Register a bundle; its scalar knobs become tunables under feel.impact.<id>. */
    define(bundle, registry = defaultRegistry) {
        this.bundles.set(bundle.id, bundle);
        this.tuned.set(bundle.id, registry.define(`feel.impact.${bundle.id}`, {
            hitstopMs: { min: 0, max: 400, step: 1, default: bundle.hitstopMs ?? 0 },
            trauma: { min: 0, max: 1, step: 0.01, default: bundle.trauma ?? 0 },
            vfxScale: { min: 0, max: 3, step: 0.01, default: 1 },
            postScale: { min: 0, max: 3, step: 0.01, default: 1 },
            rumbleScale: { min: 0, max: 2, step: 0.01, default: 1 },
            flashScale: { min: 0, max: 2, step: 0.01, default: 1 },
            slowmoScale: { min: 0.05, max: 1, step: 0.01, default: bundle.slowmo?.scale ?? 1 },
            slowmoMs: { min: 0, max: 2000, step: 10, default: bundle.slowmo?.ms ?? 0 }
        }));
    }
    /** One semantic call: hitstop + shake + VFX + post pulse + audio event + rumble + flash. */
    impact(id, context = {}) {
        const b = this.bundles.get(id);
        if (!b)
            return null;
        const recipe = this.recipe(b);
        const instance = this.player.play(recipe, context);
        return instance;
    }
    hitstop(ms) { this.time.hitstop(ms); }
    slowmo(scale, ms, easing) { if (!this.accessibility.reducedMotion || scale > 0.5)
        this.time.slowmo(scale, ms, easing);
    else
        this.time.slowmo(0.5, ms, easing); }
    addTrauma(amount) { this.shake.add(amount); }
    rumble(strength, ms) { if (this.accessibility.vibration)
        this.rumbler.play(strength, ms); }
    /** Advance one real frame. Returns the time step to feed simulation vs presentation. */
    step(realDt) {
        const step = this.time.step(realDt);
        this.player.update(realDt); // cues fire on real time so bundles complete during hitstop
        this.shake.scale = this.accessibility.screenShake * (this.accessibility.reducedMotion ? 0.35 : 1);
        this.shake.update(step.presentationDt > 0 ? realDt : 0);
        return step;
    }
    recipe(b) {
        const cues = [];
        if (b.hitstopMs || b.trauma || b.slowmo)
            cues.push({ id: "gameplay", at: 0, channel: "gameplay" });
        if (b.trauma)
            cues.push({ id: "camera", at: 0, channel: "camera" });
        b.vfx?.forEach((x, i) => cues.push({ id: `vfx${i}`, at: x.at ?? 0, channel: "vfx", payload: { id: x.id, scale: x.scale ?? 1 } }));
        b.post?.forEach((x, i) => cues.push({ id: `post${i}`, at: x.at ?? 0, channel: "ui", payload: { post: x.id, amount: x.amount } }));
        if (b.flash)
            cues.push({ id: "flash", at: 0, channel: "ui", payload: { flash: b.flash.token, amount: b.flash.amount } });
        if (b.audio)
            cues.push({ id: "audio", at: 0, channel: "audio", payload: { event: b.audio } });
        if (b.rumble)
            cues.push({ id: "rumble", at: 0, channel: "rumble", payload: { ...b.rumble } });
        const duration = Math.max(0.001, ...cues.map((c) => c.at));
        return { id: b.id, duration, cues };
    }
    dispatch(_instance, recipe, cue, context) {
        const t = this.tuned.get(recipe.id);
        const b = this.bundles.get(recipe.id);
        const p = cue.payload ?? {};
        switch (cue.channel) {
            case "gameplay":
                if (t.hitstopMs > 0)
                    this.time.hitstop(t.hitstopMs);
                if (b.slowmo && t.slowmoMs > 0)
                    this.slowmo(t.slowmoScale, t.slowmoMs, b.slowmo.easing);
                break;
            case "camera":
                this.shake.add(t.trauma);
                break;
            case "vfx":
                this.sinks.vfx?.(String(p.id), { ...(context.position ? { position: context.position } : {}), ...(context.direction ? { direction: context.direction } : {}), scale: Number(p.scale ?? 1) * t.vfxScale });
                break;
            case "ui":
                if (p.post)
                    this.sinks.post?.(String(p.post), Number(p.amount) * t.postScale);
                if (p.flash)
                    this.sinks.flash?.(String(p.flash), Math.min(1, Number(p.amount) * t.flashScale) * this.accessibility.flashes);
                break;
            case "audio":
                this.sinks.audio?.(String(p.event), context);
                break;
            case "rumble":
                this.rumble(Number(p.strength) * t.rumbleScale, Number(p.ms));
                break;
        }
    }
}
