function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
export function estimateFootPlants(foot, samples, options = {}) {
    const speedThreshold = options.speedThreshold ?? 0.12;
    const minDuration = options.minDuration ?? 0.08;
    const windows = [];
    let start;
    let confidenceSum = 0;
    let confidenceCount = 0;
    for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1];
        const b = samples[i];
        if (!a || !b)
            continue;
        const dt = b.time - a.time;
        if (dt <= 0)
            continue;
        const speed = distance(a, b) / dt;
        const planted = speed <= speedThreshold;
        if (planted) {
            if (start === undefined)
                start = a.time;
            confidenceSum += Math.max(0, 1 - speed / speedThreshold);
            confidenceCount++;
        }
        else if (start !== undefined) {
            const end = a.time;
            if (end - start >= minDuration)
                windows.push({ foot, start, end, confidence: confidenceCount ? confidenceSum / confidenceCount : 0 });
            start = undefined;
            confidenceSum = 0;
            confidenceCount = 0;
        }
    }
    const last = samples[samples.length - 1];
    if (start !== undefined && last && last.time - start >= minDuration) {
        windows.push({ foot, start, end: last.time, confidence: confidenceCount ? confidenceSum / confidenceCount : 0 });
    }
    return windows;
}
export function footPlantsToMarkers(windows, prefix = "auto") {
    return windows.map((window, index) => ({
        id: `${prefix}:${window.foot}:plant:${index + 1}`,
        at: window.start,
        kind: "foot_plant",
        payload: {
            foot: window.foot,
            end: window.end,
            confidence: window.confidence,
            generated: true,
        },
    }));
}
export function summarizeRootMotion(samples) {
    if (samples.length < 2)
        return { distance: 0, displacement: { x: 0, y: 0, z: 0 }, averageSpeed: 0, peakSpeed: 0 };
    let distanceTravelled = 0;
    let peakSpeed = 0;
    for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1];
        const b = samples[i];
        if (!a || !b)
            continue;
        const d = distance(a, b);
        distanceTravelled += d;
        const dt = b.time - a.time;
        if (dt > 0)
            peakSpeed = Math.max(peakSpeed, d / dt);
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const duration = Math.max(0, last.time - first.time);
    return {
        distance: distanceTravelled,
        displacement: { x: last.x - first.x, y: last.y - first.y, z: last.z - first.z },
        averageSpeed: duration > 0 ? distanceTravelled / duration : 0,
        peakSpeed,
    };
}
