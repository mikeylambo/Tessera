/** Gamepad rumble with a settings toggle. No-ops where the Gamepad haptics API is missing. */
export declare class Rumble {
    private readonly pads;
    enabled: boolean;
    constructor(pads?: () => ReadonlyArray<Gamepad | null>);
    play(strength: number, ms: number, weak?: number): boolean;
}
