import { ImpactPlayer } from "./ImpactPlayer.js";
export class CallbackImpactAdapter {
    player;
    constructor(hooks) {
        this.player = new ImpactPlayer(hooks);
    }
    play(recipe, context) {
        return this.player.play(recipe, context);
    }
    stop(instanceId) {
        this.player.stop(instanceId);
    }
    update(deltaSeconds) {
        this.player.update(deltaSeconds);
    }
    getActiveCount() {
        return this.player.getActiveCount();
    }
}
