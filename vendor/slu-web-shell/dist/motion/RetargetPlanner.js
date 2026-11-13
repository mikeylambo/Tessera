import { SLU_HUMANOID_REQUIRED_BONES } from "./SLUHumanoidRig.js";
export function createRetargetPlan(request) {
    const bindings = [];
    const sourceOnly = [];
    const targetOnly = [];
    const all = new Set([
        ...Object.keys(request.sourceRig.humanoid),
        ...Object.keys(request.targetRig.humanoid),
    ]);
    for (const semantic of all) {
        const sourceBone = request.sourceRig.humanoid[semantic];
        const targetBone = request.targetRig.humanoid[semantic];
        if (sourceBone && targetBone)
            bindings.push({ semantic, sourceBone, targetBone });
        else if (sourceBone)
            sourceOnly.push(semantic);
        else if (targetBone)
            targetOnly.push(semantic);
    }
    const requiredMissing = SLU_HUMANOID_REQUIRED_BONES.filter((semantic) => !request.sourceRig.humanoid[semantic] || !request.targetRig.humanoid[semantic]);
    const sourceScale = request.sourceRig.scaleMeters ?? 1;
    const targetScale = request.targetHeightMeters ?? request.targetRig.scaleMeters ?? sourceScale;
    const scaleRatio = sourceScale > 0 ? targetScale / sourceScale : 1;
    const warnings = [];
    if (requiredMissing.length)
        warnings.push(`Missing required semantic bones: ${requiredMissing.join(", ")}`);
    if (Math.abs(scaleRatio - 1) > 0.35)
        warnings.push(`Large retarget scale ratio (${scaleRatio.toFixed(2)}x); verify root motion and stride.`);
    if (request.sourceRig.forwardAxis !== request.targetRig.forwardAxis)
        warnings.push("Forward-axis conversion required.");
    if (request.sourceRig.upAxis !== request.targetRig.upAxis)
        warnings.push("Up-axis conversion required.");
    return {
        sourceRigId: request.sourceRig.id,
        targetRigId: request.targetRig.id,
        bindings,
        sourceOnly,
        targetOnly,
        requiredMissing,
        scaleRatio,
        preserveRootMotion: request.preserveRootMotion ?? true,
        preserveFootPlants: request.preserveFootPlants ?? true,
        warnings,
    };
}
