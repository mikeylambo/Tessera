import type { ImpactCue, ImpactRecipe, ImpactSpawnContext } from "./types.js";
export interface ImpactPlayerHooks {
    onCue(instanceId: string, recipe: ImpactRecipe, cue: ImpactCue, context: ImpactSpawnContext): void;
    onComplete?(instanceId: string, recipe: ImpactRecipe): void;
}
export declare class ImpactPlayer {
    private readonly hooks;
    private readonly active;
    constructor(hooks: ImpactPlayerHooks);
    play(recipe: ImpactRecipe, context?: ImpactSpawnContext): string;
    stop(instanceId: string): void;
    update(deltaSeconds: number): void;
    private dispatchDue;
    getActiveCount(): number;
}
