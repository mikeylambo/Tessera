import type { RigMap } from "../types.js";
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
export declare const CYBER_RONIN_RIG: RigMap;
