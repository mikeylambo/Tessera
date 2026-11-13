export declare class EntityPool<T extends {
    active: boolean;
}> {
    readonly items: T[];
    constructor(capacity: number, factory: () => T);
    acquire(): T | undefined;
    clear(): void;
    get count(): number;
}
export declare class SpatialHash<T extends {
    x: number;
    y: number;
}> {
    readonly cellSize: number;
    private cells;
    constructor(cellSize?: number);
    clear(): void;
    insert(item: T): void;
    query(x: number, y: number, radius: number, visit: (item: T) => void): void;
    private key;
}
export declare class GridFlowField {
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;
    readonly costs: Int32Array;
    readonly blocked: Uint8Array;
    private queue;
    constructor(width: number, height: number, cellSize: number);
    rebuild(x: number, y: number): void;
    direction(x: number, y: number, out: {
        x: number;
        y: number;
    }): void;
}
