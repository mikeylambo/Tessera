import { tunables as defaultRegistry } from "../tuning/Tunables.js";
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const copy = (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerpV = (o, a, b, t) => { o.x = lerp(a.x, b.x, t); o.y = lerp(a.y, b.y, t); o.z = lerp(a.z, b.z, t); return o; };
/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate, dt) => 1 - Math.exp(-Math.max(0, rate) * dt);
/**
 * One camera rig, four commercially proven modes, blended on mode change.
 * Renderer-neutral: outputs a CameraFrame; `applyCameraFrame` (look/three) maps it onto THREE cameras.
 */
export class CameraRig {
    mode = "follow2d";
    follow2d;
    springArm;
    firstPerson;
    arena;
    frame = { position: v(), target: v(), fov: 60, roll: 0 };
    raw = { position: v(), target: v(), fov: 60, roll: 0 };
    from = null;
    blendT = 1;
    blendDur = 0;
    focus = v();
    armDist = -1;
    fovKick = 0;
    dip = 0;
    dipVel = 0;
    initialized = false;
    constructor(registry = defaultRegistry) {
        this.follow2d = registry.define("feel.camera.follow2d", {
            deadZoneX: { min: 0, max: 6, step: 0.05, default: 0.8 }, deadZoneY: { min: 0, max: 6, step: 0.05, default: 0.5 },
            lookAhead: { min: 0, max: 2, step: 0.01, default: 0.35 }, smoothing: { min: 0.5, max: 30, step: 0.1, default: 7 },
            distance: { min: 2, max: 60, step: 0.1, default: 14 }, height: { min: -5, max: 10, step: 0.05, default: 1.2 }, fov: { min: 20, max: 100, step: 0.5, default: 50 }
        });
        this.springArm = registry.define("feel.camera.springArm", {
            distance: { min: 1, max: 20, step: 0.05, default: 5 }, height: { min: 0, max: 4, step: 0.05, default: 1.6 },
            lag: { min: 1, max: 40, step: 0.5, default: 12 }, pullIn: { min: 5, max: 80, step: 1, default: 40 }, pullOut: { min: 0.5, max: 20, step: 0.1, default: 4 },
            collisionMargin: { min: 0, max: 1, step: 0.01, default: 0.25 }, fov: { min: 30, max: 110, step: 0.5, default: 62 }, shoulder: { min: -2, max: 2, step: 0.01, default: 0.4 }
        });
        this.firstPerson = registry.define("feel.camera.firstPerson", {
            fov: { min: 50, max: 120, step: 0.5, default: 90 }, fovKickDecay: { min: 1, max: 30, step: 0.5, default: 8 },
            dipStiffness: { min: 20, max: 600, step: 5, default: 180 }, dipDamping: { min: 1, max: 40, step: 0.5, default: 14 }
        });
        this.arena = registry.define("feel.camera.arena", {
            pitchDeg: { min: 10, max: 89, step: 0.5, default: 55 }, padding: { min: 0, max: 20, step: 0.1, default: 3 },
            minDistance: { min: 2, max: 100, step: 0.5, default: 10 }, maxDistance: { min: 2, max: 200, step: 0.5, default: 40 },
            smoothing: { min: 0.5, max: 20, step: 0.1, default: 4 }, fov: { min: 20, max: 90, step: 0.5, default: 45 },
            boundsMinX: { min: -500, max: 0, step: 1, default: -100 }, boundsMaxX: { min: 0, max: 500, step: 1, default: 100 },
            boundsMinZ: { min: -500, max: 0, step: 1, default: -100 }, boundsMaxZ: { min: 0, max: 500, step: 1, default: 100 }
        });
    }
    /** Switch mode; the transition blends from the current frame over `blendMs`. */
    setMode(mode, blendMs = 450) {
        if (mode === this.mode)
            return;
        this.from = { position: copy(v(), this.frame.position), target: copy(v(), this.frame.target), fov: this.frame.fov, roll: this.frame.roll };
        this.mode = mode;
        this.blendT = 0;
        this.blendDur = Math.max(0, blendMs) / 1000;
        this.armDist = -1;
    }
    /** First-person FOV kick in degrees (sprint, dash, fire). */
    kickFov(deg) { this.fovKick += deg; }
    /** Landing dip (metres of downward impulse velocity). */
    landingDip(amount) { this.dipVel -= amount * 6; }
    /** Snap without smoothing (spawn, teleport, cut). */
    snap() { this.initialized = false; this.from = null; this.blendT = 1; }
    update(dt, input) {
        const raw = this.raw;
        const t = input.target;
        if (!this.initialized) {
            copy(this.focus, t);
        }
        switch (this.mode) {
            case "follow2d": {
                const c = this.follow2d;
                const vel = input.velocity ?? v();
                const goalX = t.x + vel.x * c.lookAhead, goalY = t.y + vel.y * c.lookAhead;
                const dx = goalX - this.focus.x, dy = goalY - this.focus.y;
                const wantX = Math.abs(dx) > c.deadZoneX ? goalX - Math.sign(dx) * c.deadZoneX : this.focus.x;
                const wantY = Math.abs(dy) > c.deadZoneY ? goalY - Math.sign(dy) * c.deadZoneY : this.focus.y;
                const k = this.initialized ? damp(c.smoothing, dt) : 1;
                this.focus.x = lerp(this.focus.x, wantX, k);
                this.focus.y = lerp(this.focus.y, wantY, k);
                this.focus.z = t.z;
                raw.target = copy(raw.target, this.focus);
                raw.target.y += c.height;
                raw.position.x = raw.target.x;
                raw.position.y = raw.target.y;
                raw.position.z = this.focus.z + c.distance;
                raw.fov = c.fov;
                raw.roll = 0;
                break;
            }
            case "springArm": {
                const c = this.springArm;
                const yaw = input.yaw ?? 0, pitch = Math.max(-1.4, Math.min(1.4, input.pitch ?? 0.25));
                lerpV(this.focus, this.focus, t, this.initialized ? damp(c.lag, dt) : 1);
                const pivot = v(this.focus.x + Math.cos(yaw) * c.shoulder, this.focus.y + c.height, this.focus.z - Math.sin(yaw) * c.shoulder);
                const back = v(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
                let want = c.distance;
                if (input.probe) {
                    const hit = input.probe(pivot, v(pivot.x + back.x * c.distance, pivot.y + back.y * c.distance, pivot.z + back.z * c.distance));
                    if (hit !== null)
                        want = Math.max(0.2, hit - c.collisionMargin);
                }
                if (this.armDist < 0 || !this.initialized)
                    this.armDist = want;
                // Pull in fast (never clip), ease back out slowly.
                this.armDist = lerp(this.armDist, want, damp(want < this.armDist ? c.pullIn : c.pullOut, dt));
                raw.position = v(pivot.x + back.x * this.armDist, pivot.y + back.y * this.armDist, pivot.z + back.z * this.armDist);
                raw.target = pivot;
                raw.fov = c.fov;
                raw.roll = 0;
                break;
            }
            case "firstPerson": {
                const c = this.firstPerson;
                const yaw = input.yaw ?? 0, pitch = Math.max(-1.55, Math.min(1.55, input.pitch ?? 0));
                this.fovKick *= Math.exp(-c.fovKickDecay * dt);
                this.dipVel += (-c.dipStiffness * this.dip - c.dipDamping * this.dipVel) * dt;
                this.dip += this.dipVel * dt;
                raw.position = v(t.x, t.y + this.dip, t.z);
                raw.target = v(t.x - Math.sin(yaw) * Math.cos(pitch), t.y + this.dip + Math.sin(pitch), t.z - Math.cos(yaw) * Math.cos(pitch));
                raw.fov = c.fov + this.fovKick;
                raw.roll = 0;
                break;
            }
            case "arena": {
                const c = this.arena;
                const pts = input.targets?.length ? input.targets : [t];
                let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, sy = 0;
                for (const p of pts) {
                    minX = Math.min(minX, p.x);
                    maxX = Math.max(maxX, p.x);
                    minZ = Math.min(minZ, p.z);
                    maxZ = Math.max(maxZ, p.z);
                    sy += p.y;
                }
                const center = v(Math.max(c.boundsMinX, Math.min(c.boundsMaxX, (minX + maxX) / 2)), sy / pts.length, Math.max(c.boundsMinZ, Math.min(c.boundsMaxZ, (minZ + maxZ) / 2)));
                const aspect = input.aspect ?? 16 / 9;
                const half = Math.tan((c.fov * Math.PI) / 360);
                const spanX = (maxX - minX) / 2 + c.padding, spanZ = (maxZ - minZ) / 2 + c.padding;
                const dist = Math.max(c.minDistance, Math.min(c.maxDistance, Math.max(spanX / (half * aspect), spanZ / half)));
                lerpV(this.focus, this.focus, center, this.initialized ? damp(c.smoothing, dt) : 1);
                const pr = (c.pitchDeg * Math.PI) / 180;
                this.armDist = this.initialized && this.armDist > 0 ? lerp(this.armDist, dist, damp(c.smoothing, dt)) : dist;
                raw.target = copy(v(), this.focus);
                raw.position = v(this.focus.x, this.focus.y + Math.sin(pr) * this.armDist, this.focus.z + Math.cos(pr) * this.armDist);
                raw.fov = c.fov;
                raw.roll = 0;
                break;
            }
        }
        this.initialized = true;
        const f = this.frame;
        if (this.from && this.blendT < 1) {
            this.blendT = this.blendDur > 0 ? Math.min(1, this.blendT + dt / this.blendDur) : 1;
            const s = this.blendT * this.blendT * (3 - 2 * this.blendT);
            lerpV(f.position, this.from.position, raw.position, s);
            lerpV(f.target, this.from.target, raw.target, s);
            f.fov = lerp(this.from.fov, raw.fov, s);
            f.roll = lerp(this.from.roll, raw.roll, s);
            if (this.blendT >= 1)
                this.from = null;
        }
        else {
            copy(f.position, raw.position);
            copy(f.target, raw.target);
            f.fov = raw.fov;
            f.roll = raw.roll;
        }
        return f;
    }
}
