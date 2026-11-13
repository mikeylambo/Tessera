import { ImpactLibrary } from "../impact/ImpactLibrary.js";
import { MotionLibrary } from "./MotionLibrary.js";
import { MotionImpactBridge } from "./MotionImpactBridge.js";
import { MotionPlayer } from "./MotionPlayer.js";
import { MoveLibrary } from "./MoveAsset.js";
export class MotionImpactRuntime {
    impactRuntime;
    motions = new MotionLibrary();
    impacts = new ImpactLibrary();
    moves = new MoveLibrary();
    bridge;
    player;
    constructor(impactRuntime) {
        this.impactRuntime = impactRuntime;
        this.bridge = new MotionImpactBridge(impactRuntime);
        this.player = new MotionPlayer(this.bridge);
    }
    registerPackage(pkg) {
        this.motions.registerPack({ rigs: pkg.rigs, clips: pkg.clips });
        this.impacts.registerPack(pkg.impacts);
        for (const recipe of pkg.impacts)
            this.bridge.register(recipe);
    }
    registerMove(move) {
        this.moves.register(move);
    }
    playMove(entityId, moveId, options = {}, context = {}) {
        const move = this.moves.get(moveId);
        if (!move)
            throw new Error(`Unknown move '${moveId}'.`);
        const clip = this.motions.getClip(move.clipId);
        if (!clip)
            throw new Error(`Move '${moveId}' references unknown clip '${move.clipId}'.`);
        const mergedOptions = { ...(move.defaultPlayback ?? {}), ...options };
        const mergedContext = {
            ...(move.defaultImpactContext ?? {}),
            ...context,
            parameters: {
                ...(move.defaultImpactContext?.parameters ?? {}),
                ...(context.parameters ?? {}),
            },
        };
        return this.player.play(entityId, clip, mergedOptions, mergedContext);
    }
    stop(instanceId) {
        this.player.stop(instanceId);
    }
    update(deltaSeconds) {
        this.player.update(deltaSeconds);
        this.impactRuntime.update?.(deltaSeconds);
    }
}
