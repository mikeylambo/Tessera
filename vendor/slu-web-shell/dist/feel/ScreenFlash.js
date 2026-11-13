/**
 * Renderer-neutral full-screen flash (DOM overlay). Color comes from a palette token resolver and
 * peak opacity is capped by the accessibility flash setting. Three games can use look.post.flash instead.
 */
export class ScreenFlash {
    resolve;
    /** Accessibility cap (settings.flashes, 0..1). */
    cap = 1;
    el;
    value = 0;
    decay = 12;
    constructor(root = typeof document !== "undefined" ? document.body : null, resolve = (t) => t) {
        this.resolve = resolve;
        if (!root) {
            this.el = null;
            return;
        }
        const el = root.ownerDocument.createElement("div");
        el.setAttribute("aria-hidden", "true");
        el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147482000;opacity:0;mix-blend-mode:screen";
        root.appendChild(el);
        this.el = el;
    }
    flash(token, amount = 0.6, decayPerSecond = 12) {
        this.value = Math.max(this.value, Math.min(0.85, amount) * Math.max(0, Math.min(1, this.cap)));
        this.decay = decayPerSecond;
        if (this.el)
            this.el.style.background = this.resolve(token);
    }
    update(dt) {
        this.value *= Math.exp(-this.decay * dt);
        if (this.value < 0.002)
            this.value = 0;
        if (this.el)
            this.el.style.opacity = this.value.toFixed(3);
        return this.value;
    }
    dispose() { this.el?.remove(); }
}
