export class MotionLibrary {
    rigs = new Map();
    clips = new Map();
    registerRig(rig) {
        this.rigs.set(rig.id, structuredClone(rig));
    }
    registerClip(clip) {
        this.clips.set(clip.id, structuredClone(clip));
    }
    registerPack(pack) {
        for (const rig of pack.rigs ?? [])
            this.registerRig(rig);
        for (const clip of pack.clips ?? [])
            this.registerClip(clip);
    }
    getRig(id) {
        const rig = this.rigs.get(id);
        return rig ? structuredClone(rig) : undefined;
    }
    getClip(id) {
        const clip = this.clips.get(id);
        return clip ? structuredClone(clip) : undefined;
    }
    listRigs() {
        return [...this.rigs.values()].map((rig) => structuredClone(rig));
    }
    listClips(tags) {
        const required = tags ?? [];
        return [...this.clips.values()]
            .filter((clip) => required.every((tag) => clip.tags?.includes(tag)))
            .map((clip) => structuredClone(clip));
    }
    removeClip(id) {
        return this.clips.delete(id);
    }
    clear() {
        this.rigs.clear();
        this.clips.clear();
    }
}
