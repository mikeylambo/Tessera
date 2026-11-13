import { createMotionImpactPackage } from "./package.js";
export class MotionAuthoringSession {
    id;
    rigs = new Map();
    clips = new Map();
    impacts = new Map();
    constructor(id) {
        this.id = id;
    }
    addRig(rig) {
        this.rigs.set(rig.id, structuredClone(rig));
        return this;
    }
    addClip(clip) {
        this.clips.set(clip.id, structuredClone(clip));
        return this;
    }
    addImpact(recipe) {
        this.impacts.set(recipe.id, structuredClone(recipe));
        return this;
    }
    addMarker(clipId, marker) {
        const clip = this.requireClip(clipId);
        const markers = [...(clip.markers ?? [])].filter((existing) => existing.id !== marker.id);
        markers.push(structuredClone(marker));
        markers.sort((a, b) => a.at - b.at);
        clip.markers = markers;
        return this;
    }
    createMarker(clipId, input) {
        const clip = this.requireClip(clipId);
        const at = Math.max(0, Math.min(input.at, clip.duration));
        return this.addMarker(clipId, { ...input, at });
    }
    removeMarker(clipId, markerId) {
        const clip = this.requireClip(clipId);
        const before = clip.markers?.length ?? 0;
        clip.markers = (clip.markers ?? []).filter((marker) => marker.id !== markerId);
        return (clip.markers?.length ?? 0) < before;
    }
    bindImpact(clipId, markerId, recipeId) {
        if (!this.impacts.has(recipeId))
            throw new Error(`Unknown impact recipe '${recipeId}'.`);
        const clip = this.requireClip(clipId);
        const marker = clip.markers?.find((candidate) => candidate.id === markerId);
        if (!marker)
            throw new Error(`Unknown marker '${markerId}' on clip '${clipId}'.`);
        marker.recipeId = recipeId;
        return this;
    }
    setRootMotion(clipId, rootMotion) {
        this.requireClip(clipId).rootMotion = rootMotion;
        return this;
    }
    setTargetRig(clipId, rigId) {
        if (!this.rigs.has(rigId))
            throw new Error(`Unknown target rig '${rigId}'.`);
        this.requireClip(clipId).targetRigId = rigId;
        return this;
    }
    getClip(clipId) {
        return structuredClone(this.requireClip(clipId));
    }
    export(metadata) {
        return createMotionImpactPackage({
            id: this.id,
            rigs: [...this.rigs.values()].map((rig) => structuredClone(rig)),
            clips: [...this.clips.values()].map((clip) => structuredClone(clip)),
            impacts: [...this.impacts.values()].map((impact) => structuredClone(impact)),
            metadata,
        });
    }
    requireClip(id) {
        const clip = this.clips.get(id);
        if (!clip)
            throw new Error(`Unknown motion clip '${id}'.`);
        return clip;
    }
}
