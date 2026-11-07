import * as THREE from "three";
import { createVisualRegistry, type VisualRegistration } from "@slu/web-shell";

export interface ProceduralVisualContext {
  key: string;
  anchor?: THREE.Object3D;
  metadata?: Readonly<Record<string, unknown>>;
}

export type ProceduralVisualRegistration = VisualRegistration<THREE.Group, ProceduralVisualContext>;
export const proceduralVisuals = createVisualRegistry<THREE.Group, ProceduralVisualContext>();

export function registerProceduralVisual(key: string, registration: ProceduralVisualRegistration): void {
  proceduralVisuals.register(key, registration);
}

export function replaceProceduralVisual(key: string, registration: ProceduralVisualRegistration): void {
  proceduralVisuals.replace(key, registration);
}
