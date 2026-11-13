import type { MotionImpactPackage } from "../../motion/package.js";
import type { AdapterArtifact, MotionImpactAdapterOptions, MotionImpactEngineAdapter } from "../MotionImpactAdapter.js";
export declare function unityMarkerManifest(pkg: MotionImpactPackage): Record<string, unknown>;
export declare class UnityMotionImpactAdapter implements MotionImpactEngineAdapter {
    readonly id = "unity-6";
    readonly displayName = "Unity 6";
    exportPackage(pkg: MotionImpactPackage, options?: MotionImpactAdapterOptions): AdapterArtifact[];
}
