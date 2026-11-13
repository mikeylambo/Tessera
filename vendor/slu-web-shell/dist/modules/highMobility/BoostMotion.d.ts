export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
export interface BoostMotionTuning {
    moveSpeed: number;
    acceleration: number;
    airAcceleration: number;
    burstSpeed: number;
    burstDuration: number;
    burstCost: number;
    burstCooldown: number;
    overdriveSpeed: number;
    overdriveDrainPerSecond: number;
    liftSpeed: number;
    liftDrainPerSecond: number;
    descendSpeed: number;
    groundEnergyRegenPerSecond: number;
    airEnergyRegenPerSecond: number;
    energyRegenDelay: number;
    maxEnergy: number;
}
export declare const DEFAULT_BOOST_MOTION_TUNING: BoostMotionTuning;
export interface BoostMotionInput {
    moveX: number;
    moveZ: number;
    rise: boolean;
    descend: boolean;
    burstPressed: boolean;
    overdrivePressed: boolean;
}
export type BoostMotionEvent = "motion.burst" | "motion.overdrive.start" | "motion.overdrive.stop" | "motion.lift.start" | "motion.land" | "energy.empty";
export interface BoostMotionState {
    position: Vec3;
    velocity: Vec3;
    energy: number;
    grounded: boolean;
    overdrive: boolean;
    burstTime: number;
    burstCooldown: number;
    regenDelay: number;
    burstDirection: Vec3;
    wasRising: boolean;
}
export interface BoostMotionStep {
    state: BoostMotionState;
    events: BoostMotionEvent[];
}
export declare const createBoostMotionState: (position?: Vec3) => BoostMotionState;
export declare class BoostMotionController {
    tuning: BoostMotionTuning;
    constructor(tuning?: BoostMotionTuning);
    step(current: BoostMotionState, input: BoostMotionInput, facing: Vec3, dtSeconds: number, groundHeight?: number): BoostMotionStep;
}
