export class RuntimeEventBus {
    listeners = new Map();
    on(event, listener) {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(listener);
        return () => set?.delete(listener);
    }
    emit(event, payload) {
        for (const listener of this.listeners.get(event) ?? [])
            listener(payload);
    }
    clear() {
        this.listeners.clear();
    }
}
export class ObjectPool {
    create;
    reset;
    free = [];
    used = new Set();
    constructor(create, reset = () => { }, prewarm = 0) {
        this.create = create;
        this.reset = reset;
        for (let i = 0; i < prewarm; i++)
            this.free.push(create());
    }
    acquire() {
        const item = this.free.pop() ?? this.create();
        this.used.add(item);
        return item;
    }
    release(item) {
        if (!this.used.delete(item))
            return false;
        this.reset(item);
        this.free.push(item);
        return true;
    }
    releaseAll() {
        for (const item of [...this.used])
            this.release(item);
    }
    get activeCount() { return this.used.size; }
    get availableCount() { return this.free.length; }
}
/** XZ spatial hash for broad-phase combat/world queries. */
export class SpatialHashXZ {
    cellSize;
    cells = new Map();
    memberships = new Map();
    constructor(cellSize = 64) {
        this.cellSize = cellSize;
    }
    upsert(entry) {
        this.remove(entry.id);
        const radius = Math.max(0, entry.radius ?? 0);
        const minX = Math.floor((entry.position.x - radius) / this.cellSize);
        const maxX = Math.floor((entry.position.x + radius) / this.cellSize);
        const minZ = Math.floor((entry.position.z - radius) / this.cellSize);
        const maxZ = Math.floor((entry.position.z + radius) / this.cellSize);
        const keys = [];
        for (let x = minX; x <= maxX; x++)
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x}:${z}`;
                keys.push(key);
                let cell = this.cells.get(key);
                if (!cell)
                    this.cells.set(key, cell = new Set());
                cell.add(entry);
            }
        this.memberships.set(entry.id, keys);
    }
    remove(id) {
        const keys = this.memberships.get(id);
        if (!keys)
            return;
        for (const key of keys) {
            const cell = this.cells.get(key);
            if (!cell)
                continue;
            for (const entry of cell)
                if (entry.id === id)
                    cell.delete(entry);
            if (!cell.size)
                this.cells.delete(key);
        }
        this.memberships.delete(id);
    }
    queryRadius(position, radius) {
        const minX = Math.floor((position.x - radius) / this.cellSize);
        const maxX = Math.floor((position.x + radius) / this.cellSize);
        const minZ = Math.floor((position.z - radius) / this.cellSize);
        const maxZ = Math.floor((position.z + radius) / this.cellSize);
        const unique = new Map();
        const r2 = radius * radius;
        for (let x = minX; x <= maxX; x++)
            for (let z = minZ; z <= maxZ; z++) {
                for (const entry of this.cells.get(`${x}:${z}`) ?? []) {
                    const dx = entry.position.x - position.x;
                    const dz = entry.position.z - position.z;
                    const extent = entry.radius ?? 0;
                    if (dx * dx + dz * dz <= (radius + extent) * (radius + extent) || dx * dx + dz * dz <= r2)
                        unique.set(entry.id, entry);
                }
            }
        return [...unique.values()];
    }
    clear() {
        this.cells.clear();
        this.memberships.clear();
    }
}
export class HeightField {
    cellSize;
    sampleHeight;
    constructor(cellSize, sampleHeight) {
        this.cellSize = cellSize;
        this.sampleHeight = sampleHeight;
    }
    heightAt(x, z) {
        const gx = x / this.cellSize;
        const gz = z / this.cellSize;
        const x0 = Math.floor(gx), z0 = Math.floor(gz);
        const tx = gx - x0, tz = gz - z0;
        const h00 = this.sampleHeight(x0, z0);
        const h10 = this.sampleHeight(x0 + 1, z0);
        const h01 = this.sampleHeight(x0, z0 + 1);
        const h11 = this.sampleHeight(x0 + 1, z0 + 1);
        return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
    }
}
export class PerformanceSampler {
    elapsed = 0;
    frames = 0;
    worst = 0;
    current = { fps: 0, frameMs: 0, worstFrameMs: 0, samples: 0 };
    sample(dtSeconds) {
        const dt = Math.max(0, dtSeconds);
        const ms = dt * 1000;
        this.elapsed += dt;
        this.frames++;
        this.worst = Math.max(this.worst, ms);
        if (this.elapsed < 0.5)
            return null;
        this.current = {
            fps: this.frames / this.elapsed,
            frameMs: this.elapsed * 1000 / this.frames,
            worstFrameMs: this.worst,
            samples: this.current.samples + 1
        };
        this.elapsed = 0;
        this.frames = 0;
        this.worst = 0;
        return this.snapshot();
    }
    snapshot() {
        return { ...this.current };
    }
}
const lerp = (a, b, t) => a + (b - a) * t;
