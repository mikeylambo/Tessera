/** Gamepad rumble with a settings toggle. No-ops where the Gamepad haptics API is missing. */
export class Rumble {
    pads;
    enabled = true;
    constructor(pads = () => (typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [])) {
        this.pads = pads;
    }
    play(strength, ms, weak = strength * 0.6) {
        if (!this.enabled || strength <= 0 || ms <= 0)
            return false;
        let played = false;
        for (const pad of this.pads()) {
            const actuator = pad?.vibrationActuator;
            if (actuator?.playEffect) {
                void actuator.playEffect("dual-rumble", { duration: ms, strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, weak) }).catch(() => { });
                played = true;
            }
        }
        return played;
    }
}
