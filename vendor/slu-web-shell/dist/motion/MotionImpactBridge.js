export class MotionImpactBridge {
    impact;
    recipes = new Map();
    fired = new Set();
    constructor(impact) {
        this.impact = impact;
    }
    register(recipe) {
        this.recipes.set(recipe.id, recipe);
    }
    reset(instanceId) {
        for (const key of this.fired) {
            if (key.startsWith(`${instanceId}:`))
                this.fired.delete(key);
        }
    }
    update(instanceId, clip, previousTime, currentTime, context) {
        const markers = clip.markers ?? [];
        const firedNow = [];
        for (const marker of markers) {
            if (marker.at <= previousTime || marker.at > currentTime)
                continue;
            const key = `${instanceId}:${marker.id}`;
            if (this.fired.has(key))
                continue;
            this.fired.add(key);
            firedNow.push(marker);
            if (marker.recipeId) {
                const recipe = this.recipes.get(marker.recipeId);
                if (recipe)
                    this.impact.play(recipe, context);
            }
        }
        return firedNow;
    }
}
