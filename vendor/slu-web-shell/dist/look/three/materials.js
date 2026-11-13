import * as THREE from "three";
import { allGlsl } from "../glsl/chunks.js";
import { patchMaterial, POSITION_VARYINGS } from "./patch.js";
import { TunedUniforms } from "./TunedUniforms.js";
export const SLU_MATERIAL_IDS = ["slu.scan", "slu.lit", "slu.rim", "slu.voidglass", "slu.voidglass.ss", "slu.dissolve", "slu.energy", "slu.outline"];
const GLSL = allGlsl;
export class SluMaterials {
    ctx;
    scan;
    lit;
    rim;
    voidglass;
    dissolve;
    energy;
    outline;
    glitchUniforms = new Set();
    constructor(ctx) {
        this.ctx = ctx;
        const { registry: r, palette: p } = ctx;
        this.scan = new TunedUniforms("look.mat.scan", {
            bands: { min: 1, max: 8, step: 1, default: 4 }, remap: { min: 0, max: 1, step: 0.01, default: 0.85 },
            low: { type: "color", default: "void.deep" }, mid: { type: "color", default: "soul" }, high: { type: "color", default: "highlight" },
            normalStrength: { min: 0, max: 1, step: 0.01, default: 0.35 }, cavity: { min: 0, max: 1, step: 0.01, default: 0.5 },
            roughness: { min: 0, max: 1, step: 0.01, default: 0.85 }, rim: { type: "bool", default: true }
        }, r, p);
        this.lit = new TunedUniforms("look.mat.lit", {
            base: { type: "color", default: "soul" }, steps: { min: 1, max: 6, step: 1, default: 3 },
            soft: { min: 0, max: 1, step: 0.01, default: 0.12 }, wrap: { min: 0, max: 1, step: 0.01, default: 0.3 },
            shadowTint: { type: "color", default: "shadow" }, shadowLift: { min: 0, max: 1, step: 0.01, default: 0.55 },
            specSize: { min: 0, max: 0.5, step: 0.005, default: 0.06 }, specIntensity: { min: 0, max: 2, step: 0.01, default: 0.6 }
        }, r, p);
        this.rim = new TunedUniforms("look.mat.rim", {
            color: { type: "color", default: "edge" }, power: { min: 0.5, max: 8, step: 0.1, default: 2.6 },
            width: { min: 0.01, max: 1, step: 0.01, default: 0.55 }, intensity: { min: 0, max: 4, step: 0.01, default: 1.4 },
            pulseRate: { min: 0, max: 8, step: 0.05, default: 0 }, pulseDepth: { min: 0, max: 1, step: 0.01, default: 0.4 }
        }, r, p);
        this.voidglass = new TunedUniforms("look.mat.voidglass", {
            tint: { type: "color", default: "void" }, filmA: { type: "color", default: "soul" }, filmB: { type: "color", default: "edge" },
            filmC: { type: "color", default: "ember" }, film: { min: 0, max: 1, step: 0.01, default: 0.55 },
            filmThickness: { min: 0.1, max: 4, step: 0.01, default: 1.4 }, refraction: { min: 0, max: 0.2, step: 0.001, default: 0.06 },
            stars: { min: 0, max: 2, step: 0.01, default: 0.9 }, starDensity: { min: 2, max: 40, step: 0.5, default: 14 },
            edge: { min: 0, max: 4, step: 0.01, default: 1.6 }, edgeColor: { type: "color", default: "edge" },
            ior: { min: 1, max: 2.33, step: 0.01, default: 1.35 }, thickness: { min: 0, max: 4, step: 0.01, default: 1.2 }
        }, r, p);
        this.dissolve = new TunedUniforms("look.mat.dissolve", {
            scale: { min: 0.2, max: 12, step: 0.1, default: 3 }, edgeWidth: { min: 0.005, max: 0.3, step: 0.005, default: 0.08 },
            edgeIntensity: { min: 0, max: 8, step: 0.05, default: 3.5 }, edgeColor: { type: "color", default: "ember" },
            mode: { options: ["noise", "directional", "radial"], default: "noise" }
        }, r, p);
        this.energy = new TunedUniforms("look.mat.energy", {
            color: { type: "color", default: "energy" }, edgeColor: { type: "color", default: "edge" },
            scanDensity: { min: 1, max: 200, step: 1, default: 60 }, scanSpeed: { min: 0, max: 20, step: 0.1, default: 3 },
            scanStrength: { min: 0, max: 1, step: 0.01, default: 0.45 }, fresnel: { min: 0.5, max: 6, step: 0.1, default: 2 },
            jitter: { min: 0, max: 0.2, step: 0.001, default: 0.01 }, flicker: { min: 0, max: 1, step: 0.01, default: 0.25 },
            opacity: { min: 0, max: 1, step: 0.01, default: 0.75 }, additive: { type: "bool", default: true }
        }, r, p);
        this.outline = new TunedUniforms("look.mat.outline", {
            color: { type: "color", default: "void.deep" }, width: { min: 0, max: 0.2, step: 0.001, default: 0.025 },
            screenSpace: { min: 0, max: 1, step: 0.01, default: 0.6 }, falloff: { min: 0, max: 0.2, step: 0.001, default: 0.02 }
        }, r, p);
    }
    create(id, o = {}) {
        switch (id) {
            case "slu.scan": return this.createScan(o);
            case "slu.lit": return this.createLit(o);
            case "slu.rim": return this.applyRim(this.createLit(o));
            case "slu.voidglass": return this.createVoidglassPhysical();
            case "slu.voidglass.ss": return this.createVoidglassScreenSpace();
            case "slu.dissolve": {
                const m = this.createLit(o);
                this.applyDissolve(m);
                return m;
            }
            case "slu.energy": return this.createEnergy();
            case "slu.outline": return this.createOutlineMaterial();
            default: throw new Error(`Unknown SLU material: ${id}`);
        }
    }
    /** 1. Scan Stylizer: photoreal scans → posterized, palette-remapped SLU surfaces. */
    createScan(o = {}) {
        const m = new THREE.MeshStandardMaterial({ map: o.map ?? null, normalMap: o.normalMap ?? null, vertexColors: !!o.vertexColors, metalness: 0, side: o.side ?? THREE.FrontSide });
        if (o.color)
            m.color.set(this.ctx.palette.resolve(o.color));
        this.scan.onSync(() => { m.roughness = this.scan.num("roughness"); m.normalScale.setScalar(this.scan.num("normalStrength")); });
        patchMaterial(m, {
            key: "slu.scan", uniforms: this.scan.uniforms, fragmentPars: `${GLSL}\n${this.scan.glsl()}`,
            fragment: { color_fragment: `$
        float sluL = slu_luma(diffuseColor.rgb);
        float sluCav = mix(1.0, smoothstep(0.02, 0.45, sluL) * 0.65 + 0.35, u_cavity);
        vec3 sluRamp = slu_ramp3(slu_posterize(pow(sluL, 0.8), u_bands), u_low, u_mid, u_high);
        diffuseColor.rgb = mix(diffuseColor.rgb, sluRamp, u_remap) * sluCav;` }
        });
        if (this.scan.values.rim)
            this.applyRim(m);
        return m;
    }
    /** 2. Stylized Lit: banded toon ramp, shadow tint token, specular blob, light wrap. All Three lights + shadows. */
    createLit(o = {}) {
        const m = new THREE.MeshToonMaterial({ map: o.map ?? null, vertexColors: !!o.vertexColors, side: o.side ?? THREE.FrontSide });
        const fixed = o.color ? this.ctx.palette.resolve(o.color) : null;
        this.lit.onSync(() => { m.color.set(fixed ?? this.ctx.palette.resolve(this.lit.str("base"))); });
        patchMaterial(m, {
            key: "slu.lit", uniforms: this.lit.uniforms, fragmentPars: `${GLSL}\n${this.lit.glsl()}`,
            fragment: {
                gradientmap_pars_fragment: `vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
          float b = slu_toonBand(slu_wrapLight(dot(normal, lightDirection), u_wrap), u_steps, u_soft);
          return mix(u_shadowTint * u_shadowLift, vec3(1.0), b);
        }`,
                lights_fragment_end: `$
        #if NUM_DIR_LIGHTS > 0
          vec3 sluH = normalize(directionalLights[0].direction + geometryViewDir);
          float sluS = dot(normal, sluH);
          float sluEdge = 1.0 - u_specSize;
          reflectedLight.directSpecular += directionalLights[0].color * smoothstep(sluEdge, sluEdge + 0.012, sluS) * u_specIntensity * step(0.0001, u_specSize);
        #endif`
            }
        });
        return m;
    }
    /** 3. Rim / Fresnel glow layer for any lit material. */
    applyRim(m) {
        return patchMaterial(m, {
            key: "slu.rim", uniforms: { ...this.rim.uniforms, u_time: this.ctx.time },
            fragmentPars: `${m.userData.sluPatches?.length ? "" : GLSL}\n${this.rim.glsl()}\nuniform float u_time;`,
            fragment: { emissivemap_fragment: `$
        float sluRim = slu_rimBand(slu_fresnel(normal, vViewPosition, u_power), u_width);
        float sluPulse = 1.0 - u_pulseDepth * (0.5 + 0.5 * sin(u_time * u_pulseRate * 6.2831853)) * step(0.0001, u_pulseRate);
        totalEmissiveRadiance += u_color * sluRim * u_intensity * sluPulse;` }
        });
    }
    /** 5. Dissolve layer: noise threshold with emissive burn edge; directional/radial modes. */
    applyDissolve(m) {
        const control = { progress: 0, origin: new THREE.Vector3(), direction: new THREE.Vector3(0, 1, 0), extent: 2 };
        const inst = {
            u_disProgress: { get value() { return control.progress * 1.04 - 0.02; } },
            u_disOrigin: { value: control.origin }, u_disDir: { value: control.direction },
            u_disExtent: { get value() { return control.extent; } }
        };
        const needsGlsl = !(m.userData.sluPatches?.length);
        patchMaterial(m, {
            key: "slu.dissolve", uniforms: { ...this.dissolve.uniforms, ...inst },
            vertexPars: POSITION_VARYINGS.pars, vertex: { project_vertex: POSITION_VARYINGS.vertex },
            fragmentPars: `${needsGlsl ? GLSL : ""}\n${this.dissolve.glsl()}\n${POSITION_VARYINGS.pars}\nuniform float u_disProgress; uniform vec3 u_disOrigin; uniform vec3 u_disDir; uniform float u_disExtent;`,
            fragment: {
                clipping_planes_fragment: `$
        float sluN = slu_fbm3(vSluWorld * u_scale);
        if (u_mode == 1) sluN = mix(sluN, clamp(dot(vSluWorld - u_disOrigin, normalize(u_disDir)) / u_disExtent * 0.5 + 0.5, 0.0, 1.0), 0.75);
        if (u_mode == 2) sluN = mix(sluN, clamp(length(vSluWorld - u_disOrigin) / u_disExtent, 0.0, 1.0), 0.75);
        vec2 sluD = slu_dissolve(sluN, u_disProgress, u_edgeWidth);
        if (sluD.x < 0.5) discard;`,
                emissivemap_fragment: `$
        totalEmissiveRadiance += u_edgeColor * sluD.y * u_edgeIntensity;`
            }
        });
        m.userData.sluDissolve = control;
        return control;
    }
    /** 4a. Voidglass on MeshPhysicalMaterial (transmission + iridescence) with palette film, stars and edge glow. */
    createVoidglassPhysical() {
        const v = this.voidglass;
        const m = new THREE.MeshPhysicalMaterial({ transmission: 1, roughness: 0.04, metalness: 0, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 620], specularIntensity: 1 });
        v.onSync(() => { m.ior = v.num("ior"); m.thickness = v.num("thickness"); m.iridescence = v.num("film"); v.color("tint", m.attenuationColor); m.attenuationDistance = 1.2; v.color("tint", m.color).lerp(new THREE.Color(1, 1, 1), 0.65); });
        patchMaterial(m, {
            key: "slu.voidglass", uniforms: { ...v.uniforms, u_time: this.ctx.time },
            vertexPars: POSITION_VARYINGS.pars, vertex: { project_vertex: POSITION_VARYINGS.vertex },
            fragmentPars: `${GLSL}\n${v.glsl()}\nuniform float u_time;\n${POSITION_VARYINGS.pars}`,
            fragment: { emissivemap_fragment: `$
        float sluCos = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
        float sluFr = 1.0 - sluCos;
        vec3 sluFilm = slu_thinFilm(sluCos, u_filmThickness, u_filmA, u_filmB, u_filmC);
        vec3 sluStarP = vSluObject * u_starDensity + vec3(0.0, u_time * 0.05, 0.0) - normalize(vViewPosition) * 0.6;
        float sluStar = pow(slu_noise3(sluStarP), 18.0) * 24.0;
        totalEmissiveRadiance += sluFilm * u_film * sluFr * 0.35 + u_edgeColor * pow(sluFr, 3.0) * u_edge + u_filmA * sluStar * u_stars * sluCos;` }
        });
        return m;
    }
    /** 4b. Voidglass with SLU screen-space refraction of the opaque pass (LookKit captures it). */
    createVoidglassScreenSpace() {
        const v = this.voidglass;
        const m = new THREE.ShaderMaterial({
            uniforms: { ...v.uniforms, u_time: this.ctx.time, u_opaque: this.ctx.opaque, u_resolution: this.ctx.resolution },
            vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vObj;
        void main(){ vObj = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
            fragmentShader: `${GLSL}\n${v.glsl()}\nuniform float u_time; uniform sampler2D u_opaque; uniform vec2 u_resolution;
        varying vec3 vN; varying vec3 vV; varying vec3 vObj;
        void main(){
          vec3 n = normalize(vN); float c = clamp(abs(dot(n, normalize(vV))), 0.0, 1.0); float fr = 1.0 - c;
          vec2 uv = gl_FragCoord.xy / u_resolution;
          vec2 off = n.xy * u_refraction * (0.4 + fr);
          vec3 bg = vec3(texture2D(u_opaque, uv + off).r, texture2D(u_opaque, uv + off * 1.06).g, texture2D(u_opaque, uv + off * 1.12).b);
          vec3 film = slu_thinFilm(c, u_filmThickness, u_filmA, u_filmB, u_filmC);
          float star = pow(slu_noise3(vObj * u_starDensity + vec3(0.0, u_time*0.05, 0.0) - normalize(vV)*0.6), 18.0) * 24.0;
          vec3 col = mix(bg * mix(vec3(1.0), u_tint * 2.2, 0.55), film, u_film * (0.25 + 0.6 * fr));
          col += u_filmA * star * u_stars * c + u_edgeColor * pow(fr, 3.0) * u_edge;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
        });
        m.userData.sluNeedsOpaque = true;
        return m;
    }
    /** 7. Energy / Hologram: scanlines, fresnel, jitter, flicker, additive mode, glitch bursts. */
    createEnergy() {
        const e = this.energy;
        const glitch = { value: 0 };
        this.glitchUniforms.add(glitch);
        const m = new THREE.ShaderMaterial({
            uniforms: { ...e.uniforms, u_time: this.ctx.time, u_glitch: glitch },
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
            vertexShader: `${GLSL}\n${e.glsl()}\nuniform float u_time; uniform float u_glitch; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main(){
          vec3 p = position;
          float line = floor((modelMatrix*vec4(p,1.0)).y * 24.0);
          float j = (slu_hash11(line + floor(u_time*20.0)) - 0.5) * u_jitter * (1.0 + u_glitch * 12.0);
          p.x += j * step(0.8 - u_glitch * 0.6, slu_hash11(line * 1.7 + floor(u_time*7.0)));
          vec4 w = modelMatrix * vec4(p,1.0); vW = w.xyz; vec4 mv = viewMatrix * w;
          vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
            fragmentShader: `${GLSL}\n${e.glsl()}\nuniform float u_time; uniform float u_glitch; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main(){
          float fr = slu_fresnel(vN, vV, u_fresnel);
          float scan = 1.0 - u_scanStrength * (0.5 + 0.5 * sin(vW.y * u_scanDensity - u_time * u_scanSpeed));
          float flick = 1.0 - u_flicker * step(0.9, slu_hash11(floor(u_time * 24.0)));
          vec3 col = mix(u_color, u_edgeColor, fr) * scan * flick;
          col += vec3(u_glitch) * vec3(1.0, 0.2, 0.6) * step(0.5, slu_hash11(floor(vW.y*40.0)+floor(u_time*30.0)));
          float a = clamp((0.25 + fr) * u_opacity * scan * flick, 0.0, 1.0);
          gl_FragColor = vec4(col * (u_additive > 0.5 ? a : 1.0), u_additive > 0.5 ? 1.0 : a);
          #include <colorspace_fragment>
        }`
        });
        e.onSync(() => {
            const additive = e.values.additive === true;
            m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
            m.needsUpdate = true;
        });
        m.userData.sluGlitch = glitch;
        return m;
    }
    /** Trigger an energy material's glitch burst. */
    glitch(m, amount = 1) { const g = m.userData.sluGlitch; if (g)
        g.value = Math.max(g.value, amount); }
    /** 6. Inverted-hull outline material (pair with createOutline). */
    createOutlineMaterial() {
        const o = this.outline;
        const m = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
        o.onSync(() => o.color("color", m.color));
        patchMaterial(m, {
            key: "slu.outline", uniforms: o.uniforms, vertexPars: o.glsl(),
            vertex: { project_vertex: `$
        vec3 sluON = normalize(normalMatrix * normal);
        float sluOD = max(0.0, -mvPosition.z);
        mvPosition.xyz += sluON * u_width * mix(1.0, sluOD * 0.12, u_screenSpace) / (1.0 + sluOD * u_falloff);
        gl_Position = projectionMatrix * mvPosition;` }
        });
        return m;
    }
    /** Attach an inverted-hull outline to a mesh (skinned meshes share the skeleton). */
    createOutline(mesh, material = this.createOutlineMaterial()) {
        let hull;
        if (mesh.isSkinnedMesh) {
            const s = mesh;
            const h = new THREE.SkinnedMesh(s.geometry, material);
            h.bind(s.skeleton, s.bindMatrix);
            hull = h;
        }
        else
            hull = new THREE.Mesh(mesh.geometry, material);
        hull.name = "slu.outline";
        hull.userData.sluPresentationOnly = true;
        hull.raycast = () => { };
        mesh.add(hull);
        return hull;
    }
    update(dt) {
        for (const g of this.glitchUniforms)
            g.value = Math.max(0, g.value - dt * 3);
    }
}
