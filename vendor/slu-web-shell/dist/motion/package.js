export function validateMotionImpactPackage(pkg) {
    const issues = [];
    const rigIds = new Set();
    const clipIds = new Set();
    const impactIds = new Set();
    if (pkg.schema !== "slu-motion-impact")
        issues.push({ severity: "error", path: "schema", message: "Unsupported motion-impact schema." });
    if (pkg.version !== 1)
        issues.push({ severity: "error", path: "version", message: `Unsupported motion-impact version '${String(pkg.version)}'.` });
    if (!pkg.id.trim())
        issues.push({ severity: "error", path: "id", message: "Package id cannot be empty." });
    for (const rig of pkg.rigs) {
        if (!rig.id.trim())
            issues.push({ severity: "error", path: "rigs", message: "Rig id cannot be empty." });
        if (rigIds.has(rig.id))
            issues.push({ severity: "error", path: `rigs.${rig.id}`, message: "Duplicate rig id." });
        rigIds.add(rig.id);
    }
    for (const clip of pkg.clips) {
        if (!clip.id.trim())
            issues.push({ severity: "error", path: "clips", message: "Clip id cannot be empty." });
        if (clipIds.has(clip.id))
            issues.push({ severity: "error", path: `clips.${clip.id}`, message: "Duplicate clip id." });
        clipIds.add(clip.id);
        if (!Number.isFinite(clip.duration) || clip.duration <= 0)
            issues.push({ severity: "error", path: `clips.${clip.id}.duration`, message: "Duration must be a finite number greater than zero." });
        if (clip.targetRigId && !rigIds.has(clip.targetRigId))
            issues.push({ severity: "warning", path: `clips.${clip.id}.targetRigId`, message: `Target rig '${clip.targetRigId}' is not included in package.` });
        const markerIds = new Set();
        let previousMarkerTime = -Infinity;
        for (const marker of clip.markers ?? []) {
            if (markerIds.has(marker.id))
                issues.push({ severity: "error", path: `clips.${clip.id}.markers.${marker.id}`, message: "Duplicate marker id within clip." });
            markerIds.add(marker.id);
            if (!Number.isFinite(marker.at) || marker.at < 0 || marker.at > clip.duration)
                issues.push({ severity: "error", path: `clips.${clip.id}.markers.${marker.id}`, message: "Marker time is outside clip duration." });
            if (marker.at < previousMarkerTime)
                issues.push({ severity: "warning", path: `clips.${clip.id}.markers.${marker.id}`, message: "Markers are not sorted by time." });
            previousMarkerTime = marker.at;
        }
    }
    for (const impact of pkg.impacts) {
        if (!impact.id.trim())
            issues.push({ severity: "error", path: "impacts", message: "Impact id cannot be empty." });
        if (impactIds.has(impact.id))
            issues.push({ severity: "error", path: `impacts.${impact.id}`, message: "Duplicate impact id." });
        impactIds.add(impact.id);
        if (!Number.isFinite(impact.duration) || impact.duration < 0)
            issues.push({ severity: "error", path: `impacts.${impact.id}.duration`, message: "Duration must be finite and cannot be negative." });
        const cueIds = new Set();
        let previousCueTime = -Infinity;
        for (const cue of impact.cues) {
            if (cueIds.has(cue.id))
                issues.push({ severity: "error", path: `impacts.${impact.id}.cues.${cue.id}`, message: "Duplicate cue id within impact recipe." });
            cueIds.add(cue.id);
            if (!Number.isFinite(cue.at) || cue.at < 0 || cue.at > impact.duration)
                issues.push({ severity: "error", path: `impacts.${impact.id}.cues.${cue.id}`, message: "Cue time is outside recipe duration." });
            if (cue.at < previousCueTime)
                issues.push({ severity: "warning", path: `impacts.${impact.id}.cues.${cue.id}`, message: "Cues are not sorted by time." });
            previousCueTime = cue.at;
        }
    }
    for (const clip of pkg.clips) {
        for (const marker of clip.markers ?? []) {
            if (marker.recipeId && !impactIds.has(marker.recipeId))
                issues.push({ severity: "warning", path: `clips.${clip.id}.markers.${marker.id}.recipeId`, message: `Impact recipe '${marker.recipeId}' is not included in package.` });
        }
    }
    return { valid: !issues.some((issue) => issue.severity === "error"), issues };
}
export function createMotionImpactPackage(input) {
    return { schema: "slu-motion-impact", version: 1, ...input };
}
