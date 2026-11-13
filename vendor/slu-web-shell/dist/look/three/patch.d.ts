import * as THREE from "three";
export type UniformMap = Record<string, THREE.IUniform>;
export interface ShaderPatch {
    key: string;
    uniforms?: UniformMap;
    vertexPars?: string;
    fragmentPars?: string;
    /** Replace `#include <chunk>` with code; use `$` to keep the original include in place. */
    vertex?: Record<string, string>;
    fragment?: Record<string, string>;
}
/** Chainable onBeforeCompile patching. Layers (rim, dissolve…) stack on any built-in material. */
export declare function patchMaterial<M extends THREE.Material>(material: M, patch: ShaderPatch): M;
/** World + object position varyings, instancing-aware. */
export declare const POSITION_VARYINGS: {
    pars: string;
    vertex: string;
};
