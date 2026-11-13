function hashString(value) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function range(pair, random, fallback) {
    if (!pair)
        return fallback;
    const min = Math.min(pair[0], pair[1]);
    const max = Math.max(pair[0], pair[1]);
    return min + (max - min) * random();
}
export function resolveImpactVariation(cue, seed = 1, salt = "") {
    const mixedSeed = (seed ^ hashString(`${cue.id}:${salt}`)) >>> 0;
    const random = mulberry32(mixedSeed);
    const variation = cue.variation ?? {};
    return {
        scale: range(variation.scale, random, 1),
        rotationDegrees: range(variation.rotationDegrees, random, 0),
        pitch: range(variation.pitch, random, 1),
        intensity: range(variation.intensity, random, 1),
    };
}
