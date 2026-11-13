import * as THREE from "three";
import { allGlsl } from "../../glsl/chunks.js";
/** Mesh-effect modes sharing one shader program. */
export const FxMode = { Slash: 0, Ring: 1, Disk: 2, Beam: 3, Portal: 4, Aura: 5, Bolt: 6, Trail: 7 };
export function createFxMeshMaterial(mode, time) {
    return new THREE.ShaderMaterial({
        defines: { FX_MODE: mode },
        uniforms: {
            uTime: time, uAge: { value: 0 }, uLife: { value: 1 }, uIntensity: { value: 1 },
            uColor: { value: new THREE.Color() }, uColor2: { value: new THREE.Color() }, uParams: { value: new THREE.Vector4(1, 0, 0, 0) }
        },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vA;
      attribute float aFade;
      void main(){ vUv = uv; vObj = position; vA = aFade;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz;
        gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `${allGlsl}
      uniform float uTime; uniform float uAge; uniform float uLife; uniform float uIntensity; uniform vec3 uColor; uniform vec3 uColor2; uniform vec4 uParams;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vA;
      void main(){
        float k = clamp(uAge / max(uLife, 1e-4), 0.0, 1.0); vec3 col; float a;
      #if FX_MODE == 0
        // crescent slash: uv.x along arc, uv.y across; head leads, noise erodes the tail
        float head = mix(-0.1, 1.15, smoothstep(0.0, 0.45, k));
        float along = smoothstep(head - 0.75, head, vUv.x) * (1.0 - smoothstep(head, head + 0.05, vUv.x));
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float n = slu_fbm3(vec3(vUv.x * 6.0 - uTime * 4.0, vUv.y * 3.0, uParams.y));
        a = along * pow(across, 1.5) * smoothstep(k * 0.9, k * 0.9 + 0.3, n + 0.2) * (1.0 - smoothstep(0.7, 1.0, k));
        col = mix(uColor, uColor2, pow(across, 4.0));
      #elif FX_MODE == 1
        // shockwave ring: uv.y = 0 inner, 1 outer
        float band = 1.0 - abs(vUv.y * 2.0 - 1.0);
        a = pow(band, 2.0) * (1.0 - k) * (1.0 - k); col = mix(uColor, uColor2, band);
      #elif FX_MODE == 2
        // shock disk / flash disk: radial from center
        float r = length(vUv * 2.0 - 1.0);
        a = (1.0 - smoothstep(0.0, 1.0, r)) * (1.0 - k) * (1.0 - k); col = mix(uColor2, uColor, r);
      #elif FX_MODE == 3
        // beam: uv.y across width; core + glow; scrolling noise along uv.x
        float d = abs(vUv.y * 2.0 - 1.0);
        float n = slu_fbm3(vec3(vUv.x * uParams.x - uTime * 9.0, d * 2.0, 0.0));
        float core = 1.0 - smoothstep(0.0, 0.22, d); float glow = pow(1.0 - d, 2.5) * (0.6 + 0.6 * n);
        a = core + glow * 0.8; col = mix(uColor, uColor2, core);
      #elif FX_MODE == 4
        // portal swirl disk
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float ang = atan(p.y, p.x);
        float sw = slu_fbm3(vec3(cos(ang * 3.0 + r * 8.0 - uTime * 3.0), sin(ang * 3.0 + r * 8.0 - uTime * 3.0), r * 2.0 + uTime * 0.3));
        float rim = smoothstep(0.08, 0.0, abs(r - 0.92));
        a = (smoothstep(1.0, 0.2, r) * sw * 1.4 + rim * 1.8) * step(r, 1.0); col = mix(uColor, uColor2, sw) + uColor2 * rim;
      #elif FX_MODE == 5
        // aura shell: fresnel + rising wisps in object space
        float fr = slu_fresnel(vN, vV, 2.2);
        float w = slu_fbm3(vec3(vObj.x * 3.0, vObj.y * 2.0 - uTime * 1.8, vObj.z * 3.0));
        a = fr * (0.6 + w) ; col = mix(uColor, uColor2, fr);
      #elif FX_MODE == 6
        // lightning bolt ribbon: uv.y across
        float d = abs(vUv.y * 2.0 - 1.0);
        a = (1.0 - smoothstep(0.0, 0.35, d)) * 1.5 + pow(1.0 - d, 3.0) * 0.6; col = mix(uColor, uColor2, 1.0 - smoothstep(0.0, 0.3, d));
        a *= vA;
      #else
        // weapon trail ribbon: uv.x 0 = newest; vA = per-vertex fade
        float d = abs(vUv.y * 2.0 - 1.0);
        float n = slu_fbm3(vec3(vUv.x * 5.0 + uTime * 2.0, vUv.y * 2.0, 0.0));
        a = (1.0 - d) * vA * smoothstep(vUv.x * uParams.x, vUv.x * uParams.x + 0.3, n + 0.3); col = mix(uColor, uColor2, (1.0 - d) * vA);
      #endif
        a *= uIntensity;
        if (a < 0.002) discard;
        gl_FragColor = vec4(col * a, 0.0);
        #include <colorspace_fragment>
      }`
    });
}
