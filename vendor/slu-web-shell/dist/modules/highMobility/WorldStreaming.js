export const DEFAULT_WORLD_STREAMING_TUNING = {
    cellSize: 320,
    fullRadiusCells: 1,
    farRadiusCells: 3,
    velocityBiasSeconds: 1.25
};
/**
 * Renderer-neutral streamed grid manager. The load center is biased in the
 * travel direction so high-speed movement cannot trivially outrun cell loads.
 */
export class StreamedWorldGrid {
    tuning;
    hooks;
    loaded = new Map();
    constructor(tuning = { ...DEFAULT_WORLD_STREAMING_TUNING }, hooks) {
        this.tuning = tuning;
        this.hooks = hooks;
    }
    update(position, velocity) {
        const center = {
            x: position.x + velocity.x * this.tuning.velocityBiasSeconds,
            y: position.y,
            z: position.z + velocity.z * this.tuning.velocityBiasSeconds
        };
        const cx = Math.floor(center.x / this.tuning.cellSize);
        const cz = Math.floor(center.z / this.tuning.cellSize);
        const desired = new Map();
        for (let dx = -this.tuning.farRadiusCells; dx <= this.tuning.farRadiusCells; dx++) {
            for (let dz = -this.tuning.farRadiusCells; dz <= this.tuning.farRadiusCells; dz++) {
                const ring = Math.max(Math.abs(dx), Math.abs(dz));
                if (ring > this.tuning.farRadiusCells)
                    continue;
                const x = cx + dx, z = cz + dz;
                const key = `${x}:${z}`;
                const detail = ring <= this.tuning.fullRadiusCells ? "full" : "far";
                desired.set(key, {
                    id: { x, z }, key, detail,
                    center: {
                        x: (x + 0.5) * this.tuning.cellSize,
                        y: 0,
                        z: (z + 0.5) * this.tuning.cellSize
                    }
                });
            }
        }
        const loaded = [];
        const unloaded = [];
        for (const [key, existing] of [...this.loaded]) {
            const next = desired.get(key);
            if (!next || next.detail !== existing.detail) {
                this.hooks.unload(existing);
                this.loaded.delete(key);
                unloaded.push(key);
            }
        }
        for (const [key, cell] of desired) {
            if (this.loaded.has(key))
                continue;
            this.loaded.set(key, cell);
            this.hooks.load(cell);
            loaded.push(key);
        }
        return { loaded, unloaded };
    }
    clear() {
        for (const cell of this.loaded.values())
            this.hooks.unload(cell);
        this.loaded.clear();
    }
    snapshot() {
        return [...this.loaded.values()].map((cell) => structuredClone(cell));
    }
}
