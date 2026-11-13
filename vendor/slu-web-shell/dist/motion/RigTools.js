import { SLU_HUMANOID_REQUIRED_BONES } from "./SLUHumanoidRig.js";
const NORMALIZE_RE = /[^a-z0-9]/g;
const ALIASES = {
    hips: ["hips", "pelvis", "mixamorigHips"],
    spine: ["spine", "spine1", "spine_01", "mixamorigSpine"],
    chest: ["chest", "spine2", "spine_03", "mixamorigSpine1"],
    upperChest: ["upperchest", "spine3", "spine_05", "mixamorigSpine2"],
    neck: ["neck", "neck_01", "mixamorigNeck"],
    head: ["head", "mixamorigHead"],
    leftShoulder: ["leftshoulder", "lshoulder", "clavicle_l", "mixamorigLeftShoulder"],
    leftUpperArm: ["leftarm", "leftupperarm", "lupperarm", "upperarm_l", "mixamorigLeftArm"],
    leftLowerArm: ["leftforearm", "leftlowerarm", "lforearm", "lowerarm_l", "mixamorigLeftForeArm"],
    leftHand: ["lefthand", "lhand", "hand_l", "mixamorigLeftHand"],
    rightShoulder: ["rightshoulder", "rshoulder", "clavicle_r", "mixamorigRightShoulder"],
    rightUpperArm: ["rightarm", "rightupperarm", "rupperarm", "upperarm_r", "mixamorigRightArm"],
    rightLowerArm: ["rightforearm", "rightlowerarm", "rforearm", "lowerarm_r", "mixamorigRightForeArm"],
    rightHand: ["righthand", "rhand", "hand_r", "mixamorigRightHand"],
    leftUpperLeg: ["leftupleg", "leftupperleg", "lthigh", "thigh_l", "mixamorigLeftUpLeg"],
    leftLowerLeg: ["leftleg", "leftlowerleg", "lcalf", "calf_l", "mixamorigLeftLeg"],
    leftFoot: ["leftfoot", "lfoot", "foot_l", "mixamorigLeftFoot"],
    leftToes: ["lefttoe", "lefttoes", "ball_l", "mixamorigLeftToeBase"],
    rightUpperLeg: ["rightupleg", "rightupperleg", "rthigh", "thigh_r", "mixamorigRightUpLeg"],
    rightLowerLeg: ["rightleg", "rightlowerleg", "rcalf", "calf_r", "mixamorigRightLeg"],
    rightFoot: ["rightfoot", "rfoot", "foot_r", "mixamorigRightFoot"],
    rightToes: ["righttoe", "righttoes", "ball_r", "mixamorigRightToeBase"],
};
function normalize(value) {
    return value.toLowerCase().replace(NORMALIZE_RE, "");
}
export function inferHumanoidMap(boneNames) {
    const byNormalized = new Map();
    for (const bone of boneNames)
        byNormalized.set(normalize(bone), bone);
    const result = {};
    for (const [semantic, aliases] of Object.entries(ALIASES)) {
        for (const alias of aliases) {
            const match = byNormalized.get(normalize(alias));
            if (match) {
                result[semantic] = match;
                break;
            }
        }
    }
    return result;
}
export function buildRigMapFromBones(id, boneNames, rootBone) {
    const humanoid = inferHumanoidMap(boneNames);
    const root = rootBone ?? humanoid.hips ?? boneNames[0] ?? "Root";
    return { id, rootBone: root, humanoid, forwardAxis: "+Z", upAxis: "+Y" };
}
export function validateRigMap(rig) {
    const mapped = Object.values(rig.humanoid).filter((v) => typeof v === "string");
    const missingRequired = SLU_HUMANOID_REQUIRED_BONES.filter((bone) => !rig.humanoid[bone]);
    const counts = new Map();
    for (const bone of mapped)
        counts.set(bone, (counts.get(bone) ?? 0) + 1);
    const duplicateBoneNames = [...counts.entries()].filter(([, count]) => count > 1).map(([bone]) => bone);
    const warnings = [];
    if (!rig.humanoid.leftToes || !rig.humanoid.rightToes)
        warnings.push("Toe bones are optional but improve foot locking.");
    if (!rig.humanoid.upperChest)
        warnings.push("UpperChest is optional; chest twist fidelity may be reduced.");
    const mappedRequired = SLU_HUMANOID_REQUIRED_BONES.length - missingRequired.length;
    return {
        valid: missingRequired.length === 0 && duplicateBoneNames.length === 0,
        missingRequired,
        duplicateBoneNames,
        warnings,
        mappedCount: mapped.length,
        requiredCount: SLU_HUMANOID_REQUIRED_BONES.length,
        coverage: mappedRequired / SLU_HUMANOID_REQUIRED_BONES.length,
    };
}
