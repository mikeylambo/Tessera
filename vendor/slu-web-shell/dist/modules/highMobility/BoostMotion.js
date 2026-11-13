export const DEFAULT_BOOST_MOTION_TUNING = {
    moveSpeed: 64,
    acceleration: 15,
    airAcceleration: 9,
    burstSpeed: 190,
    burstDuration: 0.2,
    burstCost: 18,
    burstCooldown: 0.32,
    overdriveSpeed: 215,
    overdriveDrainPerSecond: 7,
    liftSpeed: 86,
    liftDrainPerSecond: 15,
    descendSpeed: 125,
    groundEnergyRegenPerSecond: 40,
    airEnergyRegenPerSecond: 17,
    energyRegenDelay: 0.55,
    maxEnergy: 100
};
export const createBoostMotionState = (position = { x: 0, y: 0, z: 0 }) => ({
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    energy: DEFAULT_BOOST_MOTION_TUNING.maxEnergy,
    grounded: position.y <= 0,
    overdrive: false,
    burstTime: 0,
    burstCooldown: 0,
    regenDelay: 0,
    burstDirection: { x: 0, y: 0, z: -1 },
    wasRising: false
});
export class BoostMotionController {
    tuning;
    constructor(tuning = { ...DEFAULT_BOOST_MOTION_TUNING }) {
        this.tuning = tuning;
    }
    step(current, input, facing, dtSeconds, groundHeight = 0) {
        const dt = clamp(dtSeconds, 0, 0.05);
        const state = cloneState(current);
        const events = [];
        state.burstCooldown = Math.max(0, state.burstCooldown - dt);
        state.regenDelay = Math.max(0, state.regenDelay - dt);
        const forward = horizontalUnit(facing, { x: 0, y: 0, z: -1 });
        const right = { x: -forward.z, y: 0, z: forward.x };
        const wish = normalizedOrZero({
            x: right.x * input.moveX + forward.x * input.moveZ,
            y: 0,
            z: right.z * input.moveX + forward.z * input.moveZ
        });
        if (input.overdrivePressed) {
            state.overdrive = !state.overdrive && state.energy > 0;
            events.push(state.overdrive ? "motion.overdrive.start" : "motion.overdrive.stop");
        }
        if (input.burstPressed && state.burstCooldown <= 0 && state.energy >= this.tuning.burstCost) {
            state.energy -= this.tuning.burstCost;
            state.regenDelay = this.tuning.energyRegenDelay;
            state.burstTime = this.tuning.burstDuration;
            state.burstCooldown = this.tuning.burstCooldown;
            state.burstDirection = lengthSq(wish) > 0.001 ? wish : forward;
            state.overdrive = false;
            events.push("motion.burst");
        }
        let consumingEnergy = false;
        const wasGrounded = state.grounded;
        if (state.burstTime > 0) {
            state.burstTime = Math.max(0, state.burstTime - dt);
            state.velocity.x = state.burstDirection.x * this.tuning.burstSpeed;
            state.velocity.z = state.burstDirection.z * this.tuning.burstSpeed;
        }
        else if (state.overdrive && state.energy > 0) {
            const driveDirection = lengthSq(wish) > 0.001 ? wish : forward;
            state.velocity.x = damp(state.velocity.x, driveDirection.x * this.tuning.overdriveSpeed, 12, dt);
            state.velocity.z = damp(state.velocity.z, driveDirection.z * this.tuning.overdriveSpeed, 12, dt);
            state.energy -= this.tuning.overdriveDrainPerSecond * dt;
            state.regenDelay = this.tuning.energyRegenDelay;
            consumingEnergy = true;
        }
        else {
            const accel = state.grounded ? this.tuning.acceleration : this.tuning.airAcceleration;
            state.velocity.x = damp(state.velocity.x, wish.x * this.tuning.moveSpeed, accel, dt);
            state.velocity.z = damp(state.velocity.z, wish.z * this.tuning.moveSpeed, accel, dt);
        }
        if (input.rise && state.energy > 0) {
            state.velocity.y = damp(state.velocity.y, this.tuning.liftSpeed, 7, dt);
            state.energy -= this.tuning.liftDrainPerSecond * dt;
            state.regenDelay = this.tuning.energyRegenDelay;
            consumingEnergy = true;
            state.grounded = false;
            if (!state.wasRising)
                events.push("motion.lift.start");
            state.wasRising = true;
        }
        else if (input.descend) {
            state.velocity.y = damp(state.velocity.y, -this.tuning.descendSpeed, 10, dt);
            state.wasRising = false;
        }
        else {
            state.velocity.y = damp(state.velocity.y, 0, 9, dt);
            state.wasRising = false;
        }
        if (state.energy <= 0) {
            state.energy = 0;
            if (state.overdrive) {
                state.overdrive = false;
                events.push("motion.overdrive.stop", "energy.empty");
            }
        }
        if (!consumingEnergy && state.regenDelay <= 0) {
            const regen = state.grounded
                ? this.tuning.groundEnergyRegenPerSecond
                : this.tuning.airEnergyRegenPerSecond;
            state.energy = Math.min(this.tuning.maxEnergy, state.energy + regen * dt);
        }
        state.position.x += state.velocity.x * dt;
        state.position.y += state.velocity.y * dt;
        state.position.z += state.velocity.z * dt;
        if (state.position.y <= groundHeight) {
            state.position.y = groundHeight;
            state.velocity.y = Math.max(0, state.velocity.y);
            state.grounded = true;
            if (!wasGrounded)
                events.push("motion.land");
        }
        else {
            state.grounded = false;
        }
        return { state, events };
    }
}
const cloneState = (state) => ({
    ...state,
    position: { ...state.position },
    velocity: { ...state.velocity },
    burstDirection: { ...state.burstDirection }
});
const damp = (value, target, lambda, dt) => target + (value - target) * Math.exp(-lambda * dt);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lengthSq = (v) => v.x * v.x + v.y * v.y + v.z * v.z;
const normalizedOrZero = (v) => {
    const length = Math.sqrt(lengthSq(v));
    return length > 0.00001 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 0 };
};
const horizontalUnit = (v, fallback) => {
    const horizontal = normalizedOrZero({ x: v.x, y: 0, z: v.z });
    return lengthSq(horizontal) > 0.001 ? horizontal : { ...fallback };
};
