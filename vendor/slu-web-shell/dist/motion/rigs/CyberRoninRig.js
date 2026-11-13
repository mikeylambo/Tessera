/**
 * First real production-style target rig certified against SLU Motion.
 * Source asset: orange-xchain-cyber-ronin.glb
 *
 * Skeleton characteristics discovered from the GLB:
 * - 41 joints
 * - Unreal-style naming (pelvis, spine_01, clavicle_l, upperarm_l, ...)
 * - twist bones for arms/legs
 * - foot and hand IK helper chains
 * - approximately 1.8m mesh height
 */
export const CYBER_RONIN_RIG = {
    id: "SLU_CyberRonin_v1",
    rootBone: "root",
    scaleMeters: 1.8,
    forwardAxis: "+Z",
    upAxis: "+Y",
    humanoid: {
        hips: "pelvis",
        spine: "spine_01",
        chest: "spine_03",
        upperChest: "spine_05",
        neck: "neck_01",
        head: "head",
        leftShoulder: "clavicle_l",
        leftUpperArm: "upperarm_l",
        leftLowerArm: "lowerarm_l",
        leftHand: "hand_l",
        rightShoulder: "clavicle_r",
        rightUpperArm: "upperarm_r",
        rightLowerArm: "lowerarm_r",
        rightHand: "hand_r",
        leftUpperLeg: "thigh_l",
        leftLowerLeg: "calf_l",
        leftFoot: "foot_l",
        leftToes: "ball_l",
        rightUpperLeg: "thigh_r",
        rightLowerLeg: "calf_r",
        rightFoot: "foot_r",
        rightToes: "ball_r",
    },
    sockets: [
        { id: "weapon_r", bone: "hand_r", tags: ["weapon", "right"] },
        { id: "weapon_l", bone: "hand_l", tags: ["weapon", "left"] },
        { id: "fx_hand_r", bone: "hand_r", tags: ["fx", "right"] },
        { id: "fx_hand_l", bone: "hand_l", tags: ["fx", "left"] },
        { id: "fx_chest", bone: "spine_05", tags: ["fx", "core"] },
        { id: "fx_head", bone: "head", tags: ["fx", "head"] },
        { id: "foot_l", bone: "foot_l", tags: ["foot", "left"] },
        { id: "foot_r", bone: "foot_r", tags: ["foot", "right"] },
        { id: "ik_foot_l", bone: "ik_foot_l", tags: ["ik", "foot", "left"] },
        { id: "ik_foot_r", bone: "ik_foot_r", tags: ["ik", "foot", "right"] },
        { id: "ik_hand_l", bone: "ik_hand_l", tags: ["ik", "hand", "left"] },
        { id: "ik_hand_r", bone: "ik_hand_r", tags: ["ik", "hand", "right"] },
        { id: "ik_hand_gun", bone: "ik_hand_gun", tags: ["ik", "weapon"] },
    ],
    metadata: {
        version: 1,
        sourceAsset: "orange-xchain-cyber-ronin.glb",
        jointCount: 41,
        animationCountAtCertification: 0,
        meshHeightMeters: 1.8,
        skeletonFamily: "unreal-style-humanoid",
        auxiliaryBones: [
            "spine_02", "spine_04", "neck_02",
            "upperarm_twist_01_l", "upperarm_twist_01_r",
            "lowerarm_twist_01_l", "lowerarm_twist_01_r",
            "thigh_twist_01_l", "thigh_twist_01_r",
            "calf_twist_01_l", "calf_twist_01_r",
            "ik_foot_root", "ik_foot_l", "ik_foot_r",
            "ik_hand_root", "ik_hand_gun", "ik_hand_r", "ik_hand_l"
        ],
        notes: "Use semantic humanoid bones for portable retargeting; preserve auxiliary twist/IK chains as engine-specific enhancement data.",
    },
};
