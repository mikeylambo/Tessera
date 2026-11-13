import type { ImpactRecipe, ImpactSignificance } from "./types.js";
export declare function significanceAtLeast(value: ImpactSignificance, minimum: ImpactSignificance): boolean;
export declare class ImpactLibrary {
    private readonly recipes;
    register(recipe: ImpactRecipe): void;
    registerPack(recipes: ImpactRecipe[]): void;
    get(id: string): ImpactRecipe | undefined;
    list(tags?: string[]): ImpactRecipe[];
    remove(id: string): boolean;
    clear(): void;
}
