import { type ImpactPlayerHooks } from "./ImpactPlayer.js";
import type { ImpactRecipe, ImpactRuntimeAdapter, ImpactSpawnContext } from "./types.js";
export declare class CallbackImpactAdapter implements ImpactRuntimeAdapter {
    private readonly player;
    constructor(hooks: ImpactPlayerHooks);
    play(recipe: ImpactRecipe, context?: ImpactSpawnContext): string;
    stop(instanceId: string): void;
    update(deltaSeconds: number): void;
    getActiveCount(): number;
}
