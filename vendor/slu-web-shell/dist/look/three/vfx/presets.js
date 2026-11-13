const c = (d) => ({ type: "color", default: d });
const n = (min, max, d, step) => ({ min, max, default: d, ...(step ? { step } : {}) });
export const SLU_VFX_PRESETS = [
    { id: "fx.lightning.arc", kind: "lightning", sustained: true, params: {
            color: c("edge"), core: c("highlight"), width: n(0.01, 0.4, 0.07), jag: n(0, 1, 0.32), branches: n(0, 4, 2, 1),
            rerollMs: n(16, 300, 60, 1), life: n(0.05, 3, 0.45), glow: n(0, 3, 1.3), flash: n(0, 2, 0.9)
        } },
    { id: "fx.wind.slash", kind: "slash", sustained: false, params: {
            color: c("edge"), core: c("highlight"), radius: n(0.3, 5, 1.6), width: n(0.05, 2, 0.45), arc: n(0.5, 4, 2.4),
            life: n(0.08, 1, 0.32), intensity: n(0, 4, 1.6), streaks: n(0, 40, 14, 1)
        } },
    { id: "fx.impact.burst", kind: "burst", sustained: false, params: {
            color: c("ember"), core: c("ember.hot"), sparks: n(0, 80, 26, 1), speed: n(0.5, 30, 9), life: n(0.05, 1.5, 0.35),
            flash: n(0, 3, 1.2), shock: n(0, 4, 1.6), gravity: n(0, 30, 9)
        } },
    { id: "fx.charge.up", kind: "charge", sustained: true, params: {
            color: c("soul"), core: c("edge"), radius: n(0.3, 5, 1.6), rate: n(10, 400, 120, 1), chargeTime: n(0.1, 4, 1.2),
            coreSize: n(0.05, 2, 0.5), intensity: n(0, 4, 1.5)
        } },
    { id: "fx.weapon.trail", kind: "trail", sustained: true, params: {
            color: c("edge"), core: c("highlight"), samples: n(4, 48, 24, 1), sampleLife: n(0.05, 1, 0.22), erosion: n(0, 2, 0.8),
            intensity: n(0, 4, 1.4), tipLength: n(0.1, 3, 1.1)
        } },
    { id: "fx.explosion", kind: "explosion", sustained: false, params: {
            color: c("ember"), core: c("ember.hot"), smoke: c("shadow"), fireballs: n(0, 40, 14, 1), debris: n(0, 80, 24, 1),
            smokePuffs: n(0, 30, 10, 1), size: n(0.2, 6, 1.4), life: n(0.2, 3, 0.9), light: n(0, 40, 6)
        } },
    { id: "fx.shockwave.ring", kind: "shockwave", sustained: false, params: {
            color: c("edge"), core: c("highlight"), radius: n(0.5, 20, 5), thickness: n(0.02, 2, 0.35), life: n(0.1, 2, 0.55),
            intensity: n(0, 4, 1.4), distortion: n(0, 2, 1)
        } },
    { id: "fx.beam.laser", kind: "beam", sustained: true, params: {
            color: c("danger"), core: c("highlight"), width: n(0.02, 2, 0.28), noise: n(0.5, 30, 8), startTime: n(0, 1, 0.12),
            endTime: n(0, 1, 0.15), flicker: n(0, 1, 0.15), intensity: n(0, 4, 1.6), impactRate: n(0, 120, 40, 1)
        } },
    { id: "fx.aura", kind: "aura", sustained: true, params: {
            color: c("soul"), core: c("edge"), shell: n(1, 1.5, 1.08), intensity: n(0, 4, 1), wispRate: n(0, 200, 30, 1), level: n(1, 3, 1, 1)
        } },
    { id: "fx.portal", kind: "portal", sustained: true, params: {
            color: c("void"), core: c("soul"), radius: n(0.3, 6, 1.4), openTime: n(0.05, 2, 0.5), closeTime: n(0.05, 2, 0.35),
            intensity: n(0, 4, 1.4), distortion: n(0, 2, 0.6), sparkRate: n(0, 100, 20, 1)
        } },
    { id: "fx.smoke.puff", kind: "smoke", sustained: false, params: {
            color: c("shadow"), tint: c("void"), puffs: n(1, 40, 10, 1), size: n(0.1, 4, 0.9), life: n(0.2, 4, 1.4),
            spread: n(0, 4, 0.8), rise: n(0, 4, 0.9), opacity: n(0, 1, 0.55)
        } }
];
