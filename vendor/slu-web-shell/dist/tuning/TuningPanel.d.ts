import { type TunableRegistry } from "./Tunables.js";
/**
 * In-house tuning panel. Generated from tunable schemas; no dependencies.
 * Backtick toggles. Fully keyboard/gamepad navigable (D-pad/arrows move, left/right adjust,
 * A/Enter activates, B/Escape closes). Save goes to the dev server (`@slu/web-shell/look/vite`)
 * and falls back to a file download.
 */
export interface TuningPanelOptions {
    registry?: TunableRegistry;
    root?: HTMLElement;
    /** Resolve a color value (palette token name or hex) to a #rrggbb for the color picker. */
    resolveColor?: (value: string) => string;
    /** Palette token names offered as color presets. */
    colorTokens?: () => string[];
    endpoint?: string;
    startOpen?: boolean;
}
export interface TuningPanelHandle {
    toggle(open?: boolean): void;
    refresh(): void;
    dispose(): void;
    readonly element: HTMLElement;
}
export declare function mountTuningPanel(options?: TuningPanelOptions): TuningPanelHandle;
