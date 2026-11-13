let nextId = 1;
export class MotionPlayer {
    bridge;
    hooks;
    active = new Map();
    constructor(bridge, hooks = {}) {
        this.bridge = bridge;
        this.hooks = hooks;
    }
    play(entityId, clip, options = {}, context) {
        const id = `motion:${nextId++}`;
        const time = Math.max(0, Math.min(options.startTime ?? 0, clip.duration));
        this.active.set(id, {
            id,
            entityId,
            clip: structuredClone(clip),
            options: { ...options },
            time,
            speed: options.speed ?? 1,
            playing: true,
            context,
        });
        this.bridge?.reset(id);
        return id;
    }
    stop(instanceId) {
        this.active.delete(instanceId);
        this.bridge?.reset(instanceId);
    }
    setSpeed(instanceId, speed) {
        const state = this.active.get(instanceId);
        if (state)
            state.speed = Number.isFinite(speed) ? speed : 1;
    }
    seek(instanceId, timeSeconds) {
        const state = this.active.get(instanceId);
        if (!state)
            return;
        state.time = Math.max(0, Math.min(timeSeconds, state.clip.duration));
        this.bridge?.reset(instanceId);
        this.hooks.onTime?.(instanceId, state.clip, state.time);
    }
    update(deltaSeconds) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
            return;
        for (const state of [...this.active.values()]) {
            if (!state.playing)
                continue;
            const previous = state.time;
            const next = previous + deltaSeconds * state.speed;
            const loop = state.options.loop ?? state.clip.loop ?? false;
            if (next <= state.clip.duration) {
                state.time = next;
                const fired = this.bridge?.update(state.id, state.clip, previous, state.time, state.context) ?? [];
                for (const marker of fired)
                    this.hooks.onMarker?.(state.id, state.clip, marker.id);
                this.hooks.onTime?.(state.id, state.clip, state.time);
                continue;
            }
            if (loop && state.clip.duration > 0) {
                this.bridge?.update(state.id, state.clip, previous, state.clip.duration, state.context);
                const wrapped = next % state.clip.duration;
                state.time = wrapped;
                this.bridge?.reset(state.id);
                const fired = this.bridge?.update(state.id, state.clip, 0, wrapped, state.context) ?? [];
                for (const marker of fired)
                    this.hooks.onMarker?.(state.id, state.clip, marker.id);
                this.hooks.onTime?.(state.id, state.clip, state.time);
            }
            else {
                state.time = state.clip.duration;
                this.bridge?.update(state.id, state.clip, previous, state.time, state.context);
                this.hooks.onTime?.(state.id, state.clip, state.time);
                this.hooks.onComplete?.(state.id, state.clip);
                this.stop(state.id);
            }
        }
    }
    getTime(instanceId) {
        return this.active.get(instanceId)?.time;
    }
    getActiveCount() {
        return this.active.size;
    }
}
