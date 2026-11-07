import * as THREE from "three";
import { proceduralVisuals, type ProceduralVisualContext } from "./ProceduralVisualRegistry";

export function attachProceduralVisual(
  anchor: THREE.Object3D,
  key: string,
  metadata?: Readonly<Record<string, unknown>>
): THREE.Group | null {
  const context: ProceduralVisualContext = { key, anchor, metadata };
  const instance = proceduralVisuals.create(key, context);
  if (!instance) return null;
  const visual = instance.visual;
  visual.userData.sluPresentationOnly = true;
  visual.userData.sluVisualKey = key;
  visual.userData.sluVisualInstance = instance;
  visual.traverse((child) => {
    child.userData.sluPresentationOnly = true;
    child.userData.sluVisualKey = key;
  });
  anchor.add(visual);
  return visual;
}

export function detachProceduralVisual(visual: THREE.Object3D): void {
  const instance = visual.userData.sluVisualInstance as { dispose?: () => void } | undefined;
  instance?.dispose?.();
  visual.removeFromParent();
  visual.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}
