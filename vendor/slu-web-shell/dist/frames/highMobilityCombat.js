import { flow } from "./types.js";
/**
 * Renderer-neutral frame for high-speed 3D combat built around burst movement,
 * vertical authority, energy management, target acquisition and break/impact.
 *
 * Keep implementation-specific physics, camera rigs, rendering and VFX in the
 * consumer adapter. The frame only defines shell flow, stats and capabilities.
 */
export const highMobilityCombatFrame = () => ({
    id: "high-mobility-combat",
    label: "High Mobility Combat",
    menuFlow: [
        ...flow("boot", "title"),
        ...flow("front", "main-menu"),
        ...flow("setup", "loadout", "mission-select"),
        ...flow("play", "sortie"),
        ...flow("post", "results", "upgrade"),
        ...flow("utility", "training", "tuning")
    ],
    modes: [
        { id: "sortie", label: "Sortie", playerCount: { min: 1, max: 1 } },
        { id: "survival", label: "Survival", playerCount: { min: 1, max: 1 } },
        { id: "duel", label: "Duel", playerCount: { min: 1, max: 2 } },
        { id: "training", label: "Training", playerCount: { min: 1, max: 1 } }
    ],
    statKeys: [
        "sorties",
        "wins",
        "kills",
        "damageDealt",
        "damageTaken",
        "breaksTriggered",
        "burstCount",
        "burstDistance",
        "airTimeMs",
        "energySpent",
        "playTimeMs"
    ],
    challengeCategories: [
        "movement",
        "survival",
        "combat",
        "boss",
        "efficiency",
        "mastery"
    ],
    recommendedModules: [
        "high-mobility-motion",
        "target-combat",
        "loadout",
        "waves",
        "progression",
        "training",
        "results",
        "replay"
    ],
    settings: {
        aimAssist: 0.65,
        cameraShake: 1,
        targetLock: "soft",
        autoTarget: true,
        holdToAscend: true
    }
});
