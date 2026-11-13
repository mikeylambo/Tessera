import * as THREE from "three";
/** Mesh-effect modes sharing one shader program. */
export declare const FxMode: {
    readonly Slash: 0;
    readonly Ring: 1;
    readonly Disk: 2;
    readonly Beam: 3;
    readonly Portal: 4;
    readonly Aura: 5;
    readonly Bolt: 6;
    readonly Trail: 7;
};
export type FxModeId = (typeof FxMode)[keyof typeof FxMode];
export declare function createFxMeshMaterial(mode: FxModeId, time: THREE.IUniform<number>): THREE.ShaderMaterial;
