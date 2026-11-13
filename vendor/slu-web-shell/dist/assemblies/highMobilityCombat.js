import { moduleHandle } from "./helpers.js";
import { BoostMotionController, TargetCombatController, TrainingManager, ResultsManager, LoadoutManager, ReplayRecorder } from "../modules/index.js";
import { highMobilityCombatFrame } from "../frames/highMobilityCombat.js";
export function createHighMobilityCombatAssembly(context) {
    const frame = highMobilityCombatFrame();
    const modules = [
        moduleHandle("high-mobility-motion", new BoostMotionController()),
        moduleHandle("target-combat", new TargetCombatController()),
        moduleHandle("loadout", new LoadoutManager()),
        moduleHandle("training", new TrainingManager()),
        moduleHandle("results", new ResultsManager()),
        moduleHandle("replay", new ReplayRecorder())
    ];
    return {
        id: frame.id,
        frame,
        modules,
        install() {
            context.shell.modes.register(frame.modes);
            if (frame.difficulties)
                context.shell.difficulty.register(frame.difficulties);
        }
    };
}
