import type { GenreFrame } from "./types.js";
/**
 * Renderer-neutral frame for high-speed 3D combat built around burst movement,
 * vertical authority, energy management, target acquisition and break/impact.
 *
 * Keep implementation-specific physics, camera rigs, rendering and VFX in the
 * consumer adapter. The frame only defines shell flow, stats and capabilities.
 */
export declare const highMobilityCombatFrame: () => GenreFrame;
