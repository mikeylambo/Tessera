import * as THREE from "three";
import { allGlsl } from "../../glsl/chunks.js";
/**
 * One instanced draw for every particle in the game. Motion is evaluated on the GPU from spawn
 * parameters, so the CPU only writes a ring-buffer slot on spawn: zero allocation during play.
 */
export class ParticlePool {
    capacity;
    mesh;
    uniforms = { uTime: { value: 0 }, uFlashCap: { value: 1 } };
    cursor = 0;
    a;
    dirtyMin = Infinity;
    dirtyMax = -1;
    constructor(capacity = 6000) {
        this.capacity = capacity;
        const g = new THREE.InstancedBufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        const attr = (n) => { const x = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n); x.setUsage(THREE.DynamicDrawUsage); return x; };
        this.a = { p0: attr(3), vel: attr(3), c0: attr(4), c1: attr(4), t: attr(4), m: attr(4) };
        g.setAttribute("aP0", this.a.p0);
        g.setAttribute("aVel", this.a.vel);
        g.setAttribute("aC0", this.a.c0);
        g.setAttribute("aC1", this.a.c1);
        g.setAttribute("aT", this.a.t);
        g.setAttribute("aM", this.a.m);
        g.instanceCount = capacity;
        // Births start far in the past so every slot is dead.
        this.a.t.array.fill(-1e6);
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms, transparent: true, depthWrite: false,
            blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
            vertexShader: `uniform float uTime;
        attribute vec3 aP0; attribute vec3 aVel; attribute vec4 aC0; attribute vec4 aC1; attribute vec4 aT; attribute vec4 aM;
        varying vec2 vUv; varying vec4 vCol; varying float vAge; varying float vShape; varying float vAdd; varying float vSeed;
        void main(){
          float age = uTime - aT.x; float life = aT.y;
          if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float k = age / life; float drag = aM.y;
          float dt = drag > 0.0001 ? (1.0 - exp(-drag * age)) / drag : age;
          vec3 p = aP0 + aVel * dt + vec3(0.0, -0.5 * aM.x * age * age, 0.0);
          vec3 v = aVel * exp(-drag * age) + vec3(0.0, -aM.x * age, 0.0);
          float size = mix(aT.z, aT.w, k);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vec2 q = position.xy * size;
          if (aM.z > 0.5 && aM.z < 1.5) { // spark: stretch along screen-space velocity
            vec3 vv = (viewMatrix * vec4(v, 0.0)).xyz; vec2 d = vv.xy; float L = length(d);
            vec2 dir = L > 1e-4 ? d / L : vec2(1.0, 0.0); vec2 nrm = vec2(-dir.y, dir.x);
            q = dir * position.x * size * (1.0 + L * aM.w) + nrm * position.y * size * 0.35;
          } else if (aM.z > 1.5 && aM.z < 2.5 || aM.z > 3.5) { // smoke/fire: slow spin
            float a = aT.x * 13.0 + age * (fract(aT.x * 7.3) - 0.5) * 2.0; mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a)); q = r * q;
          }
          mv.xy += q;
          gl_Position = projectionMatrix * mv;
          vUv = position.xy * 0.5 + 0.5; vAge = k; vShape = aM.z; vAdd = aC0.w; vSeed = fract(aT.x * 91.7);
          vCol = vec4(mix(aC0.rgb, aC1.rgb, k), aC1.w);
        }`,
            fragmentShader: `${allGlsl}
        uniform float uTime; uniform float uFlashCap;
        varying vec2 vUv; varying vec4 vCol; varying float vAge; varying float vShape; varying float vAdd; varying float vSeed;
        void main(){
          vec2 c = vUv * 2.0 - 1.0; float r = length(c); float a;
          if (vShape < 0.5) a = pow(max(0.0, 1.0 - r), 2.2);
          else if (vShape < 1.5) a = pow(max(0.0, 1.0 - r), 1.5);
          else if (vShape < 2.5) { float n = slu_fbm3(vec3(c * 1.6, vSeed * 10.0 + uTime * 0.4)); a = smoothstep(1.0, 0.2, r) * smoothstep(0.25, 0.75, n + 0.25 - vAge * 0.35); }
          else if (vShape < 3.5) a = smoothstep(0.12, 0.0, abs(r - 0.8));
          else { float n = slu_fbm3(vec3(c * 2.2, vSeed * 10.0 - uTime * 1.5)); a = smoothstep(1.0, 0.1, r) * smoothstep(0.3, 0.7, n + 0.35 - vAge * 0.6); }
          a *= vCol.a * (1.0 - smoothstep(0.7, 1.0, vAge));
          if (a < 0.003) discard;
          vec3 col = vCol.rgb;
          if (vShape > 3.5) col = mix(col * 1.3, col * 0.35, smoothstep(0.0, 1.0, vAge + r * 0.4));
          // premultiplied: additive particles contribute no coverage
          gl_FragColor = vec4(col * a * mix(1.0, uFlashCap, vAdd), a * (1.0 - vAdd));
          #include <colorspace_fragment>
        }`
        });
        this.mesh = new THREE.Mesh(g, material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 10;
        this.mesh.name = "slu.vfx.particles";
        this.mesh.userData.sluPresentationOnly = true;
    }
    spawn(s, time) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.capacity;
        const { p0, vel, c0, c1, t, m } = this.a;
        p0.setXYZ(i, s.x, s.y, s.z);
        vel.setXYZ(i, s.vx, s.vy, s.vz);
        c0.setXYZW(i, s.color0.r, s.color0.g, s.color0.b, s.additive ?? 1);
        c1.setXYZW(i, s.color1.r, s.color1.g, s.color1.b, s.alpha ?? 1);
        t.setXYZW(i, time + (s.delay ?? 0), s.life, s.size0, s.size1);
        m.setXYZW(i, s.gravity ?? 0, s.drag ?? 0, s.shape ?? 0, s.stretch ?? 0.05);
        this.dirtyMin = Math.min(this.dirtyMin, i);
        this.dirtyMax = Math.max(this.dirtyMax, i);
    }
    /** Upload only the touched instance range once per frame. */
    flush() {
        if (this.dirtyMax < 0)
            return;
        for (const attr of Object.values(this.a)) {
            attr.clearUpdateRanges();
            attr.addUpdateRange(this.dirtyMin * attr.itemSize, (this.dirtyMax - this.dirtyMin + 1) * attr.itemSize);
            attr.needsUpdate = true;
        }
        this.dirtyMin = Infinity;
        this.dirtyMax = -1;
    }
    /** Living particles (approximate, for stats). */
    alive(time) {
        let n = 0;
        const t = this.a.t.array;
        for (let i = 0; i < this.capacity; i++) {
            const age = time - t[i * 4];
            if (age >= 0 && age <= t[i * 4 + 1])
                n++;
        }
        return n;
    }
}
