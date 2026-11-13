/** Deterministic 1D gradient (Perlin) noise in [-1, 1]. */
const PERM = new Uint8Array(512);
{
    let s = 1337;
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++)
        PERM[i] = p[i & 255];
}
export function perlin1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * f * (f * (f * 6 - 15) + 10);
    const g0 = (PERM[i & 255] & 1 ? 1 : -1) * f;
    const g1 = (PERM[(i + 1) & 255] & 1 ? 1 : -1) * (f - 1);
    return (g0 + (g1 - g0) * u) * 2;
}
