import { buildRigMapFromBones, validateRigMap } from "./RigTools.js";
function inferFormat(assetUri) {
    const clean = assetUri.split(/[?#]/)[0]?.toLowerCase() ?? "";
    if (clean.endsWith(".fbx"))
        return "fbx";
    if (clean.endsWith(".glb"))
        return "glb";
    if (clean.endsWith(".gltf"))
        return "gltf";
    if (clean.endsWith(".bvh"))
        return "bvh";
    if (clean.endsWith(".vrm"))
        return "vrm";
    return "unknown";
}
export class MotionImporter {
    probe;
    constructor(probe) {
        this.probe = probe;
    }
    async import(request) {
        const probe = await this.probe.probe({ ...request, format: request.format ?? inferFormat(request.assetUri) });
        const warnings = [];
        let detectedRig = request.sourceRig;
        if (!detectedRig && probe.boneNames?.length) {
            detectedRig = buildRigMapFromBones(`detected:${request.clipName ?? probe.clipName ?? "motion"}`, probe.boneNames, probe.rootBone);
            const report = validateRigMap(detectedRig);
            if (!report.valid)
                warnings.push(`Detected rig coverage ${(report.coverage * 100).toFixed(0)}%; manual mapping may be required.`);
            warnings.push(...report.warnings);
        }
        if (!Number.isFinite(probe.duration) || probe.duration <= 0) {
            throw new Error("Motion asset probe returned an invalid duration.");
        }
        const id = request.clipName ?? probe.clipName ?? request.assetUri.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "motion";
        const clip = {
            id,
            source: request.source ?? "imported",
            assetUri: request.assetUri,
            duration: probe.duration,
            fps: probe.fps ?? request.fpsHint,
            sourceRig: detectedRig,
            targetRigId: request.targetRigId,
            rootMotion: request.rootMotion ?? "extract",
            markers: [],
            tags: request.tags ?? [],
            metadata: {
                format: request.format ?? inferFormat(request.assetUri),
                ...probe.metadata,
            },
        };
        return { clip, detectedRig, warnings };
    }
}
