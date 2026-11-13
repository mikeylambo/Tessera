/** Chainable onBeforeCompile patching. Layers (rim, dissolve…) stack on any built-in material. */
export function patchMaterial(material, patch) {
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey?.bind(material);
    const keys = (material.userData.sluPatches ?? []).concat(patch.key);
    material.userData.sluPatches = keys;
    material.onBeforeCompile = (shader, renderer) => {
        previous?.call(material, shader, renderer);
        Object.assign(shader.uniforms, patch.uniforms ?? {});
        if (patch.vertexPars)
            shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${patch.vertexPars}`);
        if (patch.fragmentPars)
            shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${patch.fragmentPars}`);
        for (const [chunk, code] of Object.entries(patch.vertex ?? {})) {
            shader.vertexShader = shader.vertexShader.replace(`#include <${chunk}>`, code.replace("$", `#include <${chunk}>`));
        }
        for (const [chunk, code] of Object.entries(patch.fragment ?? {})) {
            shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, code.replace("$", `#include <${chunk}>`));
        }
    };
    material.customProgramCacheKey = () => `${previousKey?.() ?? ""}|${keys.join(",")}`;
    material.needsUpdate = true;
    return material;
}
/** World + object position varyings, instancing-aware. */
export const POSITION_VARYINGS = {
    pars: "varying vec3 vSluWorld;\nvarying vec3 vSluObject;",
    vertex: `$
  vSluObject = position;
  #ifdef USE_INSTANCING
    vSluWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
    vSluWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`
};
