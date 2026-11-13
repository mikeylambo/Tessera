import * as THREE from "three";
import { ParticlePool } from "./ParticlePool.js";
import { createFxMeshMaterial, FxMode } from "./FxMeshMaterial.js";
import { SLU_VFX_PRESETS } from "./presets.js";
const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
const colA = new THREE.Color(), colB = new THREE.Color(), colC = new THREE.Color();
const v3 = (v, fallback = tmpD.set(0, 0, 0)) => (v ? tmpD.set(v.x, v.y, v.z) : fallback);
/**
 * Pooled VFX runtime: one GPU particle draw plus fixed pools of mesh effects. Nothing is allocated
 * during play; exhausted pools steal their oldest instance.
 */
export class VfxRuntime {
    scene;
    camera;
    palette;
    particles;
    root = new THREE.Group();
    time = { value: 0 };
    presets = new Map();
    accessibility = { flashes: 1, reducedMotion: false };
    /** Screen-space distortion hook (LookKit routes it to the post stack). */
    onDistort = null;
    params = new Map();
    active = [];
    pools = new Map();
    ribbons = [];
    lights = [];
    nextId = 1;
    constructor(scene, camera, palette, registry, presets = SLU_VFX_PRESETS, capacity = 6000) {
        this.scene = scene;
        this.camera = camera;
        this.palette = palette;
        this.root.name = "slu.vfx";
        this.root.userData.sluPresentationOnly = true;
        this.particles = new ParticlePool(capacity);
        this.particles.uniforms.uTime = this.time;
        this.particles.mesh.material.uniforms.uTime = this.time;
        this.root.add(this.particles.mesh);
        for (const preset of presets) {
            this.presets.set(preset.id, preset);
            this.params.set(preset.id, registry.define(`vfx.${preset.id}`, preset.params));
        }
        const slashGeo = arcGeometry(1, 0.7, 1, 32);
        const ringGeo = arcGeometry(1, 0.86, Math.PI * 2, 64);
        const planeGeo = new THREE.PlaneGeometry(2, 2);
        const beamGeo = new THREE.PlaneGeometry(1, 1, 16, 1);
        this.pool(FxMode.Slash, slashGeo, 16);
        this.pool(FxMode.Ring, ringGeo, 16);
        this.pool(FxMode.Disk, planeGeo, 24);
        this.pool(FxMode.Beam, beamGeo, 8);
        this.pool(FxMode.Portal, new THREE.CircleGeometry(1, 64), 4);
        this.pool(FxMode.Aura, new THREE.SphereGeometry(1, 24, 16), 8);
        for (let i = 0; i < 12; i++)
            this.ribbons.push(this.createRibbon(i < 6 ? FxMode.Bolt : FxMode.Trail, 64));
        for (let i = 0; i < 2; i++) {
            const l = new THREE.PointLight(0xffffff, 0, 8, 2);
            l.name = "slu.vfx.flash";
            this.lights.push(l);
            this.root.add(l);
        }
        scene.add(this.root);
    }
    ids() { return [...this.presets.keys()]; }
    play(id, opts = {}) {
        const preset = this.presets.get(id);
        if (!preset)
            throw new Error(`Unknown VFX: ${id}`);
        const p = this.params.get(id);
        const inst = { id: `${id}#${this.nextId++}`, preset, p, opts: { ...opts }, age: 0, stopping: -1, done: false, tick: () => { }, handle: null };
        inst.handle = {
            id: inst.id, get alive() { return !inst.done; },
            set: (o) => { Object.assign(inst.opts, o); },
            stop: () => { if (inst.stopping < 0)
                inst.stopping = inst.age; },
            release: () => { inst.onRelease?.(inst); inst.stopping = inst.age; }
        };
        this.start(inst);
        if (!inst.done)
            this.active.push(inst);
        return inst.handle;
    }
    update(dt) {
        this.time.value += dt;
        for (let i = this.active.length - 1; i >= 0; i--) {
            const inst = this.active[i];
            inst.age += dt;
            inst.tick(dt, inst);
            if (inst.done) {
                inst.end?.(inst);
                this.active.splice(i, 1);
            }
        }
        for (const l of this.lights)
            l.intensity *= Math.exp(-dt * 14);
        this.particles.uniforms.uFlashCap.value = this.accessibility.flashes;
        this.particles.flush();
    }
    activeCount() { return this.active.length; }
    stopAll() { for (const i of this.active)
        i.handle.stop(); }
    // ---------------------------------------------------------------- helpers
    col(token, target, scale = 1) { return target.set(this.palette.resolve(token)).multiplyScalar(scale); }
    main(inst, target = colA) { return this.col(inst.opts.tint ?? String(inst.p.color), target); }
    num(inst, key) { return Number(inst.p[key]); }
    spawn(s) { this.particles.spawn(s, this.time.value); }
    pool(mode, geometry, count) {
        const list = [];
        const proto = createFxMeshMaterial(mode, this.time);
        for (let i = 0; i < count; i++) {
            const mat = proto.clone();
            mat.uniforms.uTime = this.time;
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.visible = false;
            mesh.frustumCulled = false;
            mesh.renderOrder = 11;
            mesh.userData.sluPresentationOnly = true;
            this.root.add(mesh);
            list.push({ mesh, mat, busy: false, since: 0 });
        }
        this.pools.set(mode, list);
    }
    take(mode) {
        const list = this.pools.get(mode);
        const free = list.find((x) => !x.busy) ?? list.reduce((a, b) => (a.since < b.since ? a : b));
        free.busy = true;
        free.since = this.time.value;
        free.mesh.visible = true;
        free.mesh.scale.setScalar(1);
        free.mesh.position.set(0, 0, 0);
        free.mesh.quaternion.identity();
        if (free.mesh.parent !== this.root)
            this.root.add(free.mesh);
        free.mat.uniforms.uAge.value = 0;
        free.mat.uniforms.uIntensity.value = 1;
        return free;
    }
    give(x) { x.busy = false; x.mesh.visible = false; if (x.mesh.parent !== this.root)
        this.root.add(x.mesh); }
    createRibbon(mode, maxPoints) {
        const g = new THREE.BufferGeometry();
        const pos = new THREE.BufferAttribute(new Float32Array(maxPoints * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
        const uv = new THREE.BufferAttribute(new Float32Array(maxPoints * 2 * 2), 2).setUsage(THREE.DynamicDrawUsage);
        const fade = new THREE.BufferAttribute(new Float32Array(maxPoints * 2), 1).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute("position", pos);
        g.setAttribute("uv", uv);
        g.setAttribute("aFade", fade);
        g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(maxPoints * 2 * 3).fill(0), 3));
        const index = [];
        for (let i = 0; i < maxPoints - 1; i++) {
            const a = i * 2;
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        g.setIndex(index);
        g.setDrawRange(0, 0);
        const mesh = new THREE.Mesh(g, createFxMeshMaterial(mode, this.time));
        mesh.material.uniforms.uTime = this.time;
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.renderOrder = 12;
        mesh.userData.sluPresentationOnly = true;
        mesh.userData.mode = mode;
        this.root.add(mesh);
        return { mesh, busy: false, since: 0, points: Array.from({ length: maxPoints }, () => new THREE.Vector3()), ages: new Array(maxPoints).fill(0), count: 0 };
    }
    takeRibbon(mode) {
        const list = this.ribbons.filter((r) => r.mesh.userData.mode === mode);
        const r = list.find((x) => !x.busy) ?? list.reduce((a, b) => (a.since < b.since ? a : b));
        r.busy = true;
        r.since = this.time.value;
        r.count = 0;
        r.mesh.visible = true;
        return r;
    }
    /** Rebuild camera-facing ribbon vertices from points (segment 0 = newest/start). */
    buildRibbon(r, width, fade) {
        const g = r.mesh.geometry;
        const pos = g.getAttribute("position");
        const uv = g.getAttribute("uv");
        const f = g.getAttribute("aFade");
        const camPos = tmpC.setFromMatrixPosition(this.camera.matrixWorld);
        for (let i = 0; i < r.count; i++) {
            const p = r.points[i];
            const prev = r.points[Math.max(0, i - 1)];
            const next = r.points[Math.min(r.count - 1, i + 1)];
            tmpA.subVectors(next, prev);
            if (tmpA.lengthSq() < 1e-10)
                tmpA.set(1, 0, 0);
            tmpB.subVectors(camPos, p);
            tmpA.cross(tmpB).normalize().multiplyScalar(width(i));
            pos.setXYZ(i * 2, p.x + tmpA.x, p.y + tmpA.y, p.z + tmpA.z);
            pos.setXYZ(i * 2 + 1, p.x - tmpA.x, p.y - tmpA.y, p.z - tmpA.z);
            const u = r.count > 1 ? i / (r.count - 1) : 0;
            uv.setXY(i * 2, u, 0);
            uv.setXY(i * 2 + 1, u, 1);
            const fv = fade(i);
            f.setX(i * 2, fv);
            f.setX(i * 2 + 1, fv);
        }
        pos.needsUpdate = true;
        uv.needsUpdate = true;
        f.needsUpdate = true;
        g.setDrawRange(0, Math.max(0, (r.count - 1) * 6));
    }
    flashLight(at, color, intensity) {
        const l = this.lights.reduce((a, b) => (a.intensity < b.intensity ? a : b));
        l.position.copy(at);
        l.color.copy(color);
        l.intensity = intensity * this.accessibility.flashes;
    }
    glow(at, color, size, life) {
        this.spawn({ x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, life, size0: size, size1: size * 1.4, color0: color, color1: color, alpha: Math.min(1, this.accessibility.flashes), shape: 0 /* ParticleShape.Glow */ });
    }
    sparks(at, count, speed, life, c0, c1, gravity, dir, cone = 1) {
        for (let i = 0; i < count; i++) {
            tmpA.randomDirection();
            if (dir)
                tmpA.lerp(dir, 1 - cone).normalize();
            const s = speed * (0.4 + Math.random() * 0.8);
            this.spawn({ x: at.x, y: at.y, z: at.z, vx: tmpA.x * s, vy: tmpA.y * s, vz: tmpA.z * s, life: life * (0.6 + Math.random() * 0.6), size0: 0.05, size1: 0.01, color0: c0, color1: c1, shape: 1 /* ParticleShape.Spark */, gravity, drag: 3, stretch: 0.08 });
        }
    }
    orient(mesh, dir) { mesh.quaternion.setFromUnitVectors(UP, dir.lengthSq() > 0 ? dir.clone().normalize() : UP); }
    // ---------------------------------------------------------------- effects
    start(inst) {
        const k = inst.preset.kind;
        const scale = inst.opts.scale ?? 1;
        const at = v3(inst.opts.position).clone();
        const dir = (inst.opts.direction ? new THREE.Vector3(inst.opts.direction.x, inst.opts.direction.y, inst.opts.direction.z) : new THREE.Vector3(0, 0, -1)).normalize();
        const n = (key) => this.num(inst, key);
        const core = this.col(String(inst.p.core ?? inst.p.color), new THREE.Color());
        const main = this.main(inst, new THREE.Color());
        if (k === "burst") {
            this.glow(at, colC.copy(core).multiplyScalar(n("flash")), 0.9 * scale, 0.12);
            this.sparks(at, n("sparks"), n("speed") * scale, n("life"), core, main, n("gravity"), inst.opts.direction ? dir : undefined, 0.55);
            const d = this.take(FxMode.Disk);
            d.mesh.position.copy(at);
            d.mat.uniforms.uColor.value.copy(main);
            d.mat.uniforms.uColor2.value.copy(core);
            d.mat.uniforms.uLife.value = n("life") * 0.6;
            d.mat.uniforms.uIntensity.value = n("shock") * this.accessibility.flashes;
            inst.tick = (_dt, i) => { d.mat.uniforms.uAge.value = i.age; d.mesh.quaternion.copy(this.camera.quaternion); d.mesh.scale.setScalar(scale * (0.2 + 1.2 * Math.sqrt(i.age / (n("life") * 0.6)))); if (i.age >= n("life") * 0.6)
                i.done = true; };
            inst.end = () => this.give(d);
            return;
        }
        if (k === "slash") {
            const s = this.take(FxMode.Slash);
            const radius = n("radius") * scale;
            const arc = n("arc");
            s.mesh.geometry = arcGeometryCached(this, arc, 1 - n("width") / Math.max(n("radius"), 0.01));
            s.mesh.position.copy(at);
            s.mesh.scale.setScalar(radius);
            // Arc lies in the plane whose normal is perpendicular to the slash direction and world up.
            const side = new THREE.Vector3().crossVectors(dir, UP);
            if (side.lengthSq() < 1e-4)
                side.set(1, 0, 0);
            const normal = side.normalize();
            s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            s.mesh.rotateZ(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) - arc / 2);
            s.mat.uniforms.uColor.value.copy(main);
            s.mat.uniforms.uColor2.value.copy(core);
            s.mat.uniforms.uLife.value = n("life");
            s.mat.uniforms.uIntensity.value = n("intensity");
            s.mat.uniforms.uParams.value.y = Math.random() * 10;
            const streaks = n("streaks");
            for (let i = 0; i < streaks; i++) {
                const t = Math.random() * arc;
                const local = tmpA.set(Math.cos(t) * radius, Math.sin(t) * radius, 0).applyQuaternion(s.mesh.quaternion);
                const tan = tmpB.set(-Math.sin(t), Math.cos(t), 0).applyQuaternion(s.mesh.quaternion).multiplyScalar(radius * 6);
                this.spawn({ x: at.x + local.x, y: at.y + local.y, z: at.z + local.z, vx: tan.x, vy: tan.y, vz: tan.z, life: n("life") * 0.8, size0: 0.04 * scale, size1: 0.0, color0: core, color1: main, shape: 1 /* ParticleShape.Spark */, drag: 6, stretch: 0.05, delay: (t / arc) * n("life") * 0.35 });
            }
            inst.tick = (_dt, i) => { s.mat.uniforms.uAge.value = i.age; if (i.age >= n("life"))
                i.done = true; };
            inst.end = () => this.give(s);
            return;
        }
        if (k === "explosion") {
            const size = n("size") * scale;
            const life = n("life");
            const smoke = this.col(String(inst.p.smoke), new THREE.Color());
            this.flashLight(at, core, n("light"));
            this.glow(at, colC.copy(core).multiplyScalar(0.7), size * 1.1, 0.1);
            for (let i = 0; i < n("fireballs"); i++) {
                tmpA.randomDirection();
                tmpA.y = Math.abs(tmpA.y) * 0.8 + 0.2;
                this.spawn({ x: at.x + tmpA.x * size * 0.3, y: at.y + tmpA.y * size * 0.2, z: at.z + tmpA.z * size * 0.3, vx: tmpA.x * size * 2.2, vy: tmpA.y * size * 2.8, vz: tmpA.z * size * 2.2, life: life * (0.5 + Math.random() * 0.5), size0: size * 0.3, size1: size * (0.6 + Math.random() * 0.35), color0: core, color1: main, alpha: 0.9, additive: 0, shape: 4 /* ParticleShape.Fire */, drag: 2.5, delay: Math.random() * 0.05 });
            }
            this.sparks(at, n("debris"), size * 9, life * 1.2, core, main, 14);
            for (let i = 0; i < n("smokePuffs"); i++) {
                tmpA.randomDirection();
                tmpA.y = Math.abs(tmpA.y);
                this.spawn({ x: at.x + tmpA.x * size * 0.4, y: at.y + size * 0.3, z: at.z + tmpA.z * size * 0.4, vx: tmpA.x * size, vy: size * (0.8 + tmpA.y), vz: tmpA.z * size, life: life * 2.2, size0: size * 0.6, size1: size * 1.8, color0: smoke, color1: smoke, alpha: 0.6, additive: 0, shape: 2 /* ParticleShape.Smoke */, drag: 1.2, delay: life * 0.25 + Math.random() * 0.15 });
            }
            inst.done = true;
            return;
        }
        if (k === "smoke") {
            const size = n("size") * scale;
            const c1 = this.col(String(inst.p.tint), new THREE.Color());
            for (let i = 0; i < n("puffs"); i++) {
                tmpA.randomDirection();
                this.spawn({ x: at.x + tmpA.x * n("spread") * 0.3, y: at.y, z: at.z + tmpA.z * n("spread") * 0.3, vx: tmpA.x * n("spread"), vy: n("rise") * (0.6 + Math.random() * 0.6), vz: tmpA.z * n("spread"), life: n("life") * (0.7 + Math.random() * 0.5), size0: size * 0.5, size1: size * 1.6, color0: main, color1: c1, alpha: n("opacity"), additive: 0, shape: 2 /* ParticleShape.Smoke */, drag: 1.5, delay: Math.random() * 0.1 });
            }
            inst.done = true;
            return;
        }
        if (k === "shockwave") {
            const r = this.take(FxMode.Ring);
            r.mesh.position.copy(at);
            r.mesh.geometry = ringGeometryCached(this, n("thickness") / Math.max(n("radius"), 0.01));
            if (inst.opts.direction)
                r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            else
                r.mesh.rotation.x = -Math.PI / 2;
            r.mat.uniforms.uColor.value.copy(main);
            r.mat.uniforms.uColor2.value.copy(core);
            r.mat.uniforms.uLife.value = n("life");
            r.mat.uniforms.uIntensity.value = n("intensity");
            if (n("distortion") > 0)
                this.onDistort?.(at, n("distortion") * scale, n("life"));
            inst.tick = (_dt, i) => { const t = i.age / n("life"); r.mat.uniforms.uAge.value = i.age; r.mesh.scale.setScalar(Math.max(0.01, n("radius") * scale * (1 - Math.pow(1 - Math.min(t, 1), 3)))); if (t >= 1)
                i.done = true; };
            inst.end = () => this.give(r);
            return;
        }
        if (k === "lightning") {
            const bolt = this.takeRibbon(FxMode.Bolt);
            const mat = bolt.mesh.material;
            mat.uniforms.uColor.value.copy(main);
            mat.uniforms.uColor2.value.copy(core);
            mat.uniforms.uIntensity.value = n("glow");
            let reroll = 0;
            const main_ = main.clone(), core_ = core.clone();
            const segs = 20, branchSegs = 6;
            const pathStart = new THREE.Vector3(), pathEnd = new THREE.Vector3();
            const widths = new Array(64).fill(1);
            const roll = (i) => {
                pathStart.copy(v3(i.opts.position));
                pathEnd.copy(v3(i.opts.end, tmpD.copy(pathStart).add(new THREE.Vector3(0, 3, 0))));
                const len = pathStart.distanceTo(pathEnd);
                const jag = n("jag") * len * 0.25;
                const axis = tmpA.subVectors(pathEnd, pathStart).normalize();
                const perp1 = tmpB.crossVectors(axis, UP);
                if (perp1.lengthSq() < 1e-4)
                    perp1.set(1, 0, 0);
                perp1.normalize();
                const perp2 = tmpC.crossVectors(axis, perp1).normalize();
                let c = 0;
                for (let s = 0; s <= segs; s++) {
                    const t = s / segs;
                    const env = Math.sin(Math.PI * t);
                    bolt.points[c].lerpVectors(pathStart, pathEnd, t).addScaledVector(perp1, (Math.random() - 0.5) * jag * env).addScaledVector(perp2, (Math.random() - 0.5) * jag * env);
                    widths[c] = 1;
                    c++;
                }
                // Branches continue as separate ribbon spans joined with zero-width links (one draw).
                for (let b = 0; b < Math.min(4, n("branches")); b++) {
                    const from = bolt.points[2 + Math.floor(Math.random() * (segs - 4))].clone();
                    bolt.points[c].copy(from);
                    widths[c] = 0;
                    c++;
                    const bdir = new THREE.Vector3().randomDirection().lerp(axis, 0.5).normalize().multiplyScalar(len * 0.35 / branchSegs);
                    for (let s = 0; s < branchSegs; s++) {
                        from.add(bdir).addScaledVector(perp1, (Math.random() - 0.5) * jag * 0.3);
                        bolt.points[c].copy(from);
                        widths[c] = 0.55 * (1 - s / branchSegs);
                        c++;
                    }
                    bolt.points[c].copy(from);
                    widths[c] = 0;
                    c++;
                }
                bolt.count = c;
                this.glow(pathStart, colC.copy(core_).multiplyScalar(n("flash")), 0.5 * scale, 0.08);
                this.glow(pathEnd, colC.copy(core_).multiplyScalar(n("flash")), 0.7 * scale, 0.1);
                if (Math.random() < 0.5)
                    this.sparks(pathEnd, 4, 6, 0.25, core_, main_, 8);
            };
            roll(inst);
            inst.tick = (dt, i) => {
                reroll += dt * 1000;
                const interval = n("rerollMs") * (this.accessibility.reducedMotion ? 3 : 1);
                if (reroll >= interval) {
                    reroll = 0;
                    roll(i);
                }
                const life = n("life");
                const fadeOut = i.stopping >= 0 ? 1 - (i.age - i.stopping) / 0.1 : (!i.opts.sustain && i.age > life ? 1 - (i.age - life) / 0.1 : 1);
                if (fadeOut <= 0) {
                    i.done = true;
                    return;
                }
                this.buildRibbon(bolt, (j) => n("width") * scale * widths[j], (j) => (widths[j] > 0 ? fadeOut * (0.7 + 0.3 * Math.random()) : 0));
            };
            inst.end = () => { bolt.busy = false; bolt.mesh.visible = false; };
            inst.tick(0, inst);
            return;
        }
        if (k === "trail") {
            const r = this.takeRibbon(FxMode.Trail);
            const mat = r.mesh.material;
            mat.uniforms.uColor.value.copy(main);
            mat.uniforms.uColor2.value.copy(core);
            mat.uniforms.uIntensity.value = n("intensity");
            mat.uniforms.uParams.value.x = n("erosion");
            const base = new THREE.Vector3(), tip = new THREE.Vector3();
            const max = Math.min(31, n("samples"));
            // Points are stored as base/tip pairs: ribbon i spans base[i]..tip[i] via width = half span.
            const bases = Array.from({ length: 32 }, () => new THREE.Vector3());
            const tips = Array.from({ length: 32 }, () => new THREE.Vector3());
            const ages = new Array(32).fill(0);
            let count = 0;
            inst.tick = (dt, i) => {
                if (i.stopping < 0) {
                    const t = i.opts.target;
                    if (t) {
                        t.updateWorldMatrix(true, false);
                        base.setFromMatrixPosition(t.matrixWorld);
                        tip.set(0, n("tipLength"), 0).applyMatrix4(t.matrixWorld);
                    }
                    else {
                        base.copy(v3(i.opts.position));
                        tip.copy(v3(i.opts.end, tmpD.copy(base).add(new THREE.Vector3(0, n("tipLength"), 0))));
                    }
                    for (let s = Math.min(count, max - 1); s > 0; s--) {
                        bases[s].copy(bases[s - 1]);
                        tips[s].copy(tips[s - 1]);
                        ages[s] = ages[s - 1];
                    }
                    bases[0].copy(base);
                    tips[0].copy(tip);
                    ages[0] = 0;
                    count = Math.min(count + 1, max);
                }
                for (let s = 0; s < count; s++)
                    ages[s] += dt;
                while (count > 0 && ages[count - 1] > n("sampleLife"))
                    count--;
                if (i.stopping >= 0 && count === 0) {
                    i.done = true;
                    return;
                }
                // Write a quad strip directly: left = base, right = tip.
                const g = r.mesh.geometry;
                const pos = g.getAttribute("position");
                const uv = g.getAttribute("uv");
                const f = g.getAttribute("aFade");
                for (let s = 0; s < count; s++) {
                    pos.setXYZ(s * 2, bases[s].x, bases[s].y, bases[s].z);
                    pos.setXYZ(s * 2 + 1, tips[s].x, tips[s].y, tips[s].z);
                    const u = count > 1 ? s / (count - 1) : 0;
                    uv.setXY(s * 2, u, 0);
                    uv.setXY(s * 2 + 1, u, 1);
                    const fade = 1 - ages[s] / n("sampleLife");
                    f.setX(s * 2, fade);
                    f.setX(s * 2 + 1, fade);
                }
                pos.needsUpdate = true;
                uv.needsUpdate = true;
                f.needsUpdate = true;
                g.setDrawRange(0, Math.max(0, (count - 1) * 6));
            };
            inst.end = () => { r.busy = false; r.mesh.visible = false; };
            return;
        }
        if (k === "beam") {
            const b = this.take(FxMode.Beam);
            b.mat.uniforms.uColor.value.copy(main);
            b.mat.uniforms.uColor2.value.copy(core);
            let impactAcc = 0;
            const start = new THREE.Vector3(), end = new THREE.Vector3(), mid = new THREE.Vector3();
            inst.tick = (dt, i) => {
                start.copy(v3(i.opts.position));
                end.copy(v3(i.opts.end, tmpD.copy(start).addScaledVector(dir, 10)));
                const st = n("startTime"), et = n("endTime");
                const ramp = Math.min(1, st > 0 ? i.age / st : 1) * (i.stopping >= 0 ? Math.max(0, 1 - (i.age - i.stopping) / Math.max(et, 1e-3)) : 1);
                if (i.stopping >= 0 && ramp <= 0) {
                    i.done = true;
                    return;
                }
                const len = start.distanceTo(end);
                mid.addVectors(start, end).multiplyScalar(0.5);
                // Billboard around the beam axis.
                const axis = tmpA.subVectors(end, start).normalize();
                const toCam = tmpB.setFromMatrixPosition(this.camera.matrixWorld).sub(mid);
                const side = tmpC.crossVectors(axis, toCam).normalize();
                const normal = new THREE.Vector3().crossVectors(side, axis);
                b.mesh.matrixAutoUpdate = false;
                b.mesh.matrix.makeBasis(axis.clone().multiplyScalar(len), side.multiplyScalar(n("width") * scale * ramp * (1 - n("flicker") * Math.random())), normal).setPosition(mid);
                b.mat.uniforms.uParams.value.x = n("noise") * Math.max(1, len / 4);
                b.mat.uniforms.uIntensity.value = n("intensity") * ramp;
                impactAcc += dt * n("impactRate") * ramp;
                while (impactAcc >= 1) {
                    impactAcc -= 1;
                    this.glow(end, core, n("width") * scale * 2.2, 0.06);
                    if (Math.random() < 0.4)
                        this.sparks(end, 2, 5, 0.2, core, main, 6, axis.clone().negate(), 0.4);
                }
            };
            inst.end = () => { b.mesh.matrixAutoUpdate = true; this.give(b); };
            inst.tick(0, inst);
            return;
        }
        if (k === "aura") {
            const shells = [];
            const target = inst.opts.target;
            const meshes = [];
            target?.traverse((o) => { const m = o; if (m.isMesh && !m.userData.sluPresentationOnly && meshes.length < 3)
                meshes.push(m); });
            if (!meshes.length) {
                const s = this.take(FxMode.Aura);
                s.mesh.position.copy(at);
                s.mesh.scale.setScalar(scale);
                shells.push(s);
            }
            for (const m of meshes) {
                const s = this.take(FxMode.Aura);
                s.mesh.geometry = m.geometry;
                m.add(s.mesh);
                s.mesh.scale.setScalar(n("shell"));
                shells.push(s);
            }
            let wisp = 0;
            const box = new THREE.Box3();
            inst.tick = (dt, i) => {
                const level = Math.max(1, Math.min(3, i.opts.level ?? n("level")));
                const fade = Math.min(1, i.age / 0.25) * (i.stopping >= 0 ? Math.max(0, 1 - (i.age - i.stopping) / 0.3) : 1);
                if (i.stopping >= 0 && fade <= 0) {
                    i.done = true;
                    return;
                }
                for (const s of shells) {
                    s.mat.uniforms.uColor.value.copy(this.main(i, colB));
                    s.mat.uniforms.uColor2.value.copy(core);
                    s.mat.uniforms.uIntensity.value = n("intensity") * fade * (0.6 + 0.4 * level);
                }
                wisp += dt * n("wispRate") * level * fade;
                if (wisp >= 1) {
                    if (target)
                        box.setFromObject(target, false);
                    else
                        box.setFromCenterAndSize(at, tmpA.setScalar(scale * 2));
                    while (wisp >= 1) {
                        wisp -= 1;
                        const x = THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random()), z = THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random()), y = THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random() * 0.6);
                        this.spawn({ x, y, z, vx: 0, vy: 0.8 + level * 0.5, vz: 0, life: 0.8, size0: 0.08 * level, size1: 0.0, color0: core, color1: this.main(i, colC), shape: 0 /* ParticleShape.Glow */, drag: 0.5 });
                    }
                }
            };
            inst.end = () => { for (const s of shells)
                this.give(s); };
            return;
        }
        if (k === "portal") {
            const d = this.take(FxMode.Portal);
            d.mesh.position.copy(at);
            d.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            d.mat.uniforms.uColor.value.copy(main);
            d.mat.uniforms.uColor2.value.copy(core);
            const rim = this.take(FxMode.Ring);
            rim.mesh.geometry = ringGeometryCached(this, 0.06);
            rim.mesh.position.copy(at);
            rim.mesh.quaternion.copy(d.mesh.quaternion);
            rim.mat.uniforms.uColor.value.copy(core);
            rim.mat.uniforms.uColor2.value.copy(core);
            rim.mat.uniforms.uLife.value = 1e9;
            let distortAcc = 0, spark = 0;
            inst.tick = (dt, i) => {
                const open = easeOutBack(Math.min(1, i.age / n("openTime")));
                const close = i.stopping >= 0 ? Math.max(0, 1 - (i.age - i.stopping) / n("closeTime")) : 1;
                const s = Math.max(0.0001, open * close) * n("radius") * scale;
                if (i.stopping >= 0 && close <= 0) {
                    i.done = true;
                    return;
                }
                d.mesh.scale.setScalar(s);
                rim.mesh.scale.setScalar(s * 1.02);
                d.mat.uniforms.uIntensity.value = n("intensity");
                rim.mat.uniforms.uIntensity.value = n("intensity") * 0.8;
                distortAcc += dt;
                if (n("distortion") > 0 && distortAcc > 0.5) {
                    distortAcc = 0;
                    this.onDistort?.(d.mesh.position, n("distortion") * 0.5, 0.8);
                }
                spark += dt * n("sparkRate");
                while (spark >= 1) {
                    spark -= 1;
                    const a = Math.random() * Math.PI * 2;
                    tmpA.set(Math.cos(a) * s, Math.sin(a) * s, 0).applyQuaternion(d.mesh.quaternion).add(d.mesh.position);
                    tmpB.subVectors(d.mesh.position, tmpA).multiplyScalar(1.4);
                    this.spawn({ x: tmpA.x, y: tmpA.y, z: tmpA.z, vx: tmpB.x, vy: tmpB.y, vz: tmpB.z, life: 0.6, size0: 0.05, size1: 0, color0: core, color1: main, shape: 1 /* ParticleShape.Spark */, drag: 1, stretch: 0.06 });
                }
            };
            inst.end = () => { this.give(d); this.give(rim); };
            return;
        }
        if (k === "charge") {
            let acc = 0;
            const corePos = new THREE.Vector3();
            inst.onRelease = (i) => {
                const power = Math.min(1, i.age / n("chargeTime"));
                this.play("fx.impact.burst", { position: corePos, scale: (0.6 + power) * scale, tint: i.opts.tint });
                this.play("fx.shockwave.ring", { position: corePos, scale: (0.4 + power * 0.8) * scale, ...(i.opts.direction ? { direction: i.opts.direction } : {}) });
            };
            inst.tick = (dt, i) => {
                if (i.stopping >= 0) {
                    i.done = true;
                    return;
                }
                corePos.copy(v3(i.opts.target ? tmpD.setFromMatrixPosition(i.opts.target.matrixWorld) : i.opts.position));
                const ramp = Math.min(1, i.age / n("chargeTime"));
                const r = n("radius") * scale;
                acc += dt * n("rate") * (0.3 + ramp);
                while (acc >= 1) {
                    acc -= 1;
                    tmpA.randomDirection();
                    const life = 0.35 + Math.random() * 0.25;
                    this.spawn({ x: corePos.x + tmpA.x * r, y: corePos.y + tmpA.y * r, z: corePos.z + tmpA.z * r, vx: -tmpA.x * r / life, vy: -tmpA.y * r / life, vz: -tmpA.z * r / life, life, size0: 0.02, size1: 0.07 * (1 + ramp), color0: this.main(i, colB), color1: core, shape: 1 /* ParticleShape.Spark */, stretch: 0.04 });
                }
                this.glow(corePos, colC.copy(core).multiplyScalar(n("intensity") * (0.3 + ramp)), n("coreSize") * scale * (0.3 + ramp * 0.9), dt * 2.5);
            };
            return;
        }
    }
}
function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
/** Arc strip from inner→outer radius; uv.x along the arc, uv.y across. */
export function arcGeometry(outer, inner, theta, segments) {
    const pos = [], uv = [], nrm = [], idx = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments, a = t * theta, c = Math.cos(a), s = Math.sin(a);
        pos.push(c * inner, s * inner, 0, c * outer, s * outer, 0);
        uv.push(t, 0, t, 1);
        nrm.push(0, 0, 1, 0, 0, 1);
        if (i < segments) {
            const b = i * 2;
            idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setIndex(idx);
    return g;
}
// Geometry caches keyed by quantized shape so tuning never allocates per play.
const arcCache = new WeakMap();
function cached(owner, key, make) {
    let m = arcCache.get(owner);
    if (!m)
        arcCache.set(owner, (m = new Map()));
    let g = m.get(key);
    if (!g)
        m.set(key, (g = make()));
    return g;
}
function arcGeometryCached(owner, theta, innerRatio) {
    const t = Math.round(theta * 20) / 20, r = Math.round(Math.max(0.02, Math.min(0.98, innerRatio)) * 50) / 50;
    return cached(owner, `arc:${t}:${r}`, () => arcGeometry(1, r, t, 32));
}
function ringGeometryCached(owner, thicknessRatio) {
    const r = Math.round(Math.max(0.01, Math.min(0.9, thicknessRatio)) * 100) / 100;
    return cached(owner, `ring:${r}`, () => arcGeometry(1, 1 - r, Math.PI * 2, 64));
}
