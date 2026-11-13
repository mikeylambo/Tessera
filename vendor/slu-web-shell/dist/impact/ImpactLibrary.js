const SIGNIFICANCE_ORDER = ["chaff", "normal", "critical", "boss", "cinematic"];
export function significanceAtLeast(value, minimum) {
    return SIGNIFICANCE_ORDER.indexOf(value) >= SIGNIFICANCE_ORDER.indexOf(minimum);
}
export class ImpactLibrary {
    recipes = new Map();
    register(recipe) {
        this.recipes.set(recipe.id, structuredClone(recipe));
    }
    registerPack(recipes) {
        for (const recipe of recipes)
            this.register(recipe);
    }
    get(id) {
        const recipe = this.recipes.get(id);
        return recipe ? structuredClone(recipe) : undefined;
    }
    list(tags) {
        const required = tags ?? [];
        return [...this.recipes.values()]
            .filter((recipe) => required.every((tag) => recipe.tags?.includes(tag)))
            .map((recipe) => structuredClone(recipe));
    }
    remove(id) {
        return this.recipes.delete(id);
    }
    clear() {
        this.recipes.clear();
    }
}
