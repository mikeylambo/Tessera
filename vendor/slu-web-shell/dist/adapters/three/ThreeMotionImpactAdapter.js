import { MotionImpactBridge } from "../../motion/MotionImpactBridge.js";
import { MotionPlayer } from "../../motion/MotionPlayer.js";
export class ThreeMotionRuntimeAdapter {
    host;
    bridge;
    player;
    instances = new Map();
    rigs = new Map();
    recipes = new Map();
    constructor(host, impact) {
        this.host = host;
        this.bridge = new MotionImpactBridge(impact);
        this.player = new MotionPlayer(this.bridge);
    }
    registerImpact(recipe) {
        this.recipes.set(recipe.id, structuredClone(recipe));
        this.bridge.register(recipe);
    }
    loadRig(rig) {
        this.rigs.set(rig.id, structuredClone(rig));
        return this.host.loadRig?.(rig);
    }
    playClip(entityId, clip, options = {}, context) {
        const hostId = this.host.playAnimation(entityId, clip.assetUri, clip.id, options);
        const playerId = this.player.play(entityId, clip, options, context);
        this.instances.set(playerId, { hostId, playerId });
        return playerId;
    }
    stopClip(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance)
            this.host.stopAnimation(instance.hostId);
        this.player.stop(instanceId);
        this.instances.delete(instanceId);
    }
    seek(instanceId, timeSeconds) {
        const instance = this.instances.get(instanceId);
        if (instance)
            this.host.seekAnimation?.(instance.hostId, timeSeconds);
        this.player.seek(instanceId, timeSeconds);
    }
    setPlaybackSpeed(instanceId, speed) {
        const instance = this.instances.get(instanceId);
        if (instance)
            this.host.setAnimationSpeed?.(instance.hostId, speed);
        this.player.setSpeed(instanceId, speed);
    }
    update(deltaSeconds) {
        this.player.update(deltaSeconds);
    }
}
