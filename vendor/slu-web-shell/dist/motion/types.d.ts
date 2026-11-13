export type HumanoidBone = "hips" | "spine" | "chest" | "upperChest" | "neck" | "head" | "leftShoulder" | "leftUpperArm" | "leftLowerArm" | "leftHand" | "rightShoulder" | "rightUpperArm" | "rightLowerArm" | "rightHand" | "leftUpperLeg" | "leftLowerLeg" | "leftFoot" | "leftToes" | "rightUpperLeg" | "rightLowerLeg" | "rightFoot" | "rightToes";
export type Axis = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";
export interface RigSocket {
    id: string;
    bone: string;
    position?: [number, number, number];
    rotationEuler?: [number, number, number];
    tags?: string[];
}
export interface RigMap {
    id: string;
    rootBone: string;
    humanoid: Partial<Record<HumanoidBone, string>>;
    scaleMeters?: number;
    forwardAxis?: "+Z" | "-Z" | "+X" | "-X";
    upAxis?: "+Y" | "+Z";
    sockets?: RigSocket[];
    metadata?: Record<string, unknown>;
}
export type MotionMarkerKind = "impact" | "hitbox_on" | "hitbox_off" | "foot_plant" | "vfx" | "audio" | "camera" | "gameplay" | "pose" | "cancel_open" | "cancel_close" | "custom";
export interface MotionMarker {
    id: string;
    at: number;
    kind: MotionMarkerKind;
    recipeId?: string;
    payload?: Record<string, unknown>;
}
export interface MotionCurvePoint {
    time: number;
    value: number;
}
export interface MotionWarpProfile {
    speed?: MotionCurvePoint[];
    rootScale?: number;
    anticipationHoldSeconds?: number;
    recoveryHoldSeconds?: number;
}
export interface MotionClip {
    id: string;
    source: "mocap" | "keyframed" | "procedural" | "imported";
    assetUri: string;
    duration: number;
    fps?: number;
    sourceRig?: RigMap;
    targetRigId?: string;
    loop?: boolean;
    rootMotion?: "none" | "extract" | "apply";
    markers?: MotionMarker[];
    tags?: string[];
    warp?: MotionWarpProfile;
    metadata?: Record<string, unknown>;
}
export interface MotionPlayOptions {
    blendSeconds?: number;
    speed?: number;
    loop?: boolean;
    startTime?: number;
    layer?: string;
    mask?: HumanoidBone[];
}
export interface RetargetRequest {
    clip: MotionClip;
    sourceRig: RigMap;
    targetRig: RigMap;
    preserveRootMotion?: boolean;
    preserveFootPlants?: boolean;
    targetHeightMeters?: number;
}
export interface RetargetResult {
    clipId: string;
    outputAssetUri: string;
    warnings: string[];
    unmappedBones: string[];
    scaleRatio?: number;
    metadata?: Record<string, unknown>;
}
export interface MotionImportRequest {
    assetUri: string;
    format?: "fbx" | "glb" | "gltf" | "bvh" | "vrm" | "unknown";
    clipName?: string;
    source?: MotionClip["source"];
    fpsHint?: number;
    sourceRig?: RigMap;
    targetRigId?: string;
    rootMotion?: MotionClip["rootMotion"];
    tags?: string[];
}
export interface MotionImportResult {
    clip: MotionClip;
    detectedRig?: RigMap;
    warnings: string[];
}
export interface MotionRuntimeAdapter {
    loadRig(rig: RigMap): Promise<void> | void;
    importClip?(request: MotionImportRequest): Promise<MotionImportResult>;
    playClip(entityId: string, clip: MotionClip, options?: MotionPlayOptions): string;
    stopClip(instanceId: string): void;
    setPlaybackSpeed?(instanceId: string, speed: number): void;
    seek?(instanceId: string, timeSeconds: number): void;
    retarget?(request: RetargetRequest): Promise<RetargetResult>;
}
