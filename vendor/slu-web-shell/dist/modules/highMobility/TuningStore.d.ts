export type TuningRecord = Record<string, number | boolean | string>;
export type TuningListener<T extends TuningRecord> = (snapshot: Readonly<T>, changedKey: keyof T) => void;
/**
 * Small renderer-neutral live tuning store. Consumers can bind sliders/debug UI
 * without letting debug presentation become authoritative game state.
 */
export declare class TuningStore<T extends TuningRecord> {
    private values;
    private listeners;
    constructor(initial: T);
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): void;
    patch(values: Partial<T>): void;
    snapshot(): Readonly<T>;
    subscribe(listener: TuningListener<T>): () => void;
}
