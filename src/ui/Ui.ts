/**
 * Tessera's DOM UI (GDD §20–21): minimal, one decision per screen, thin etched lines, squares, no pills.
 * Keyboard / gamepad / mouse / touch navigable. Screen controllers own UI state only (GDD §30).
 */
export interface MenuItem {
  id: string;
  label: string;
  detail?: string;
  disabled?: boolean;
  /** Left/right adjusters for settings rows. */
  adjust?: (dir: -1 | 1) => void;
}

export interface ScreenSpec {
  id: string;
  title?: string;
  subtitle?: string;
  body?: string;
  items: MenuItem[];
  layout?: "list" | "grid" | "cards";
  onPick: (id: string) => void;
  onBack?: () => void;
  className?: string;
}

const CSS = /* css */ `
:root { --void:#050608; --ink:#e9e3d8; --dim:#8a8478; --line:rgba(233,227,216,0.22); --amber:#ffb347; --violet:#8b5cf6; --emerald:#2fd38a; --ui-scale:1; }
#ui { position:fixed; inset:0; pointer-events:none; font-family:"JetBrains Mono", ui-monospace, monospace; color:var(--ink); font-size:calc(14px * var(--ui-scale)); -webkit-user-select:none; user-select:none; }
#ui * { box-sizing:border-box; }
.t-screen { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:auto; background:radial-gradient(ellipse at 50% 40%, rgba(5,6,8,0.55), rgba(5,6,8,0.92)); opacity:0; transition:opacity 200ms ease; padding:max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); }
.t-screen.on { opacity:1; }
.t-screen.clear { background:transparent; }
.t-title { font-family:"Cinzel", serif; font-weight:400; letter-spacing:0.42em; text-indent:0.42em; font-size:calc(26px * var(--ui-scale)); color:var(--ink); margin:0 0 6px; text-shadow:0 0 18px rgba(255,179,71,0.18); text-align:center; }
.t-sub { color:var(--dim); letter-spacing:0.2em; font-size:calc(11px * var(--ui-scale)); margin:0 0 26px; text-transform:uppercase; text-align:center; }
.t-body { max-width:520px; color:var(--ink); line-height:1.7; text-align:center; margin:0 0 22px; opacity:0.9; }
.t-list { display:flex; flex-direction:column; gap:6px; min-width:min(360px, 92vw); }
.t-item { position:relative; display:flex; justify-content:space-between; align-items:center; gap:14px; min-height:48px; padding:10px 16px; background:rgba(10,11,14,0.6); border:1px solid var(--line); color:var(--ink); font:inherit; letter-spacing:0.12em; text-transform:uppercase; cursor:pointer; transform:translateY(10px); opacity:0; transition:transform 200ms cubic-bezier(.2,.8,.2,1), opacity 200ms, border-color 120ms, background 120ms; }
.t-screen.on .t-item { transform:none; opacity:1; }
.t-item[data-focus="1"] { border-color:var(--amber); background:rgba(255,179,71,0.07); box-shadow:inset 3px 0 0 var(--amber); }
.t-item[disabled] { color:#4d4a44; cursor:default; }
.t-item .d { color:var(--dim); font-size:0.85em; letter-spacing:0.08em; text-transform:none; }
.t-item .adj { color:var(--amber); }
.t-grid { display:grid; grid-template-columns:repeat(5, 64px); gap:8px; }
.t-grid .t-item { min-height:64px; padding:6px; flex-direction:column; justify-content:center; gap:2px; text-align:center; }
.t-grid .t-item .d { font-size:1.1em; color:var(--amber); }
.t-cards { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
.t-cards .t-item { width:min(200px, 28vw); min-width:150px; min-height:170px; flex-direction:column; justify-content:center; text-align:center; gap:10px; }
.t-cards .t-item .g { font-size:2.2em; color:var(--amber); letter-spacing:0; }
.t-press { animation:t-breathe 2.6s ease-in-out infinite; color:var(--dim); letter-spacing:0.3em; text-transform:uppercase; font-size:calc(11px * var(--ui-scale)); }
.t-hero { font-family:"Cinzel", serif; font-size:calc(min(13vw, 76px) * var(--ui-scale)); letter-spacing:0.5em; text-indent:0.5em; color:#d9d2c5; text-shadow:0 0 40px rgba(255,179,71,0.25), 0 1px 0 rgba(0,0,0,0.9); margin:0 0 30px; animation:t-etch 3s ease forwards; opacity:0; }
@keyframes t-etch { 0% { opacity:0; letter-spacing:0.9em; filter:blur(6px); } 100% { opacity:1; letter-spacing:0.5em; filter:blur(0); } }
@keyframes t-breathe { 0%,100% { opacity:0.35; } 50% { opacity:0.9; } }
.t-hud { position:absolute; inset:0; pointer-events:none; }
.t-sector { position:absolute; left:max(16px, env(safe-area-inset-left)); top:max(14px, env(safe-area-inset-top)); color:var(--dim); letter-spacing:0.18em; font-size:calc(11px * var(--ui-scale)); }
.t-score { position:absolute; left:50%; top:max(10px, env(safe-area-inset-top)); transform:translateX(-50%); font-size:calc(22px * var(--ui-scale)); letter-spacing:0.3em; color:rgba(233,227,216,0.28); transition:color 400ms, text-shadow 400ms; }
.t-score.pulse { color:rgba(255,200,130,0.85); text-shadow:0 0 18px rgba(255,179,71,0.5); transition:none; }
.t-runes { position:absolute; left:max(16px, env(safe-area-inset-left)); bottom:max(14px, env(safe-area-inset-bottom)); display:flex; gap:6px; }
.t-runes span { width:26px; height:26px; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; color:var(--amber); font-size:14px; }
.t-sub-line { position:absolute; left:50%; bottom:18%; transform:translateX(-50%); font-family:"Cinzel", serif; letter-spacing:0.3em; color:rgba(233,227,216,0.75); opacity:0; transition:opacity 600ms; font-size:calc(16px * var(--ui-scale)); white-space:nowrap; }
.t-sub-line.on { opacity:1; }
.t-touch { position:absolute; right:max(16px, env(safe-area-inset-right)); bottom:max(16px, env(safe-area-inset-bottom)); display:none; flex-direction:column; gap:12px; align-items:flex-end; pointer-events:auto; }
.t-touch.on { display:flex; }
.t-btn { width:76px; height:76px; border:1px solid rgba(255,179,71,0.55); background:rgba(10,11,14,0.45); color:var(--amber); font:inherit; letter-spacing:0.1em; display:flex; align-items:center; justify-content:center; flex-direction:column; font-size:11px; touch-action:none; }
.t-btn.small { width:60px; height:60px; border-color:rgba(47,211,138,0.5); color:var(--emerald); }
.t-btn:active { background:rgba(255,179,71,0.2); }
.t-stats { display:grid; grid-template-columns:auto auto; gap:6px 28px; margin:0 0 24px; font-size:calc(13px * var(--ui-scale)); }
.t-stats .k { color:var(--dim); letter-spacing:0.14em; text-transform:uppercase; }
.t-stats .v { text-align:right; color:var(--ink); }
.t-lead { color:var(--amber); letter-spacing:0.16em; margin:0 0 18px; text-align:center; }
.t-rating { font-size:2.2em; color:var(--amber); letter-spacing:0.4em; margin:0 0 14px; text-indent:0.4em; }
.t-notice { position:absolute; left:50%; top:52px; transform:translateX(-50%); color:var(--dim); font-size:11px; letter-spacing:0.12em; opacity:0; transition:opacity 500ms; }
.t-notice.on { opacity:1; }
.t-replay { position:absolute; inset:0; pointer-events:auto; display:flex; align-items:flex-end; justify-content:center; padding-bottom:12%; }
.t-replay .why { color:rgba(233,227,216,0.8); letter-spacing:0.22em; text-transform:uppercase; font-size:12px; }
.t-overlay { position:absolute; right:12px; top:12px; color:#9fd; font-size:11px; white-space:pre; text-align:right; opacity:0.8; }
.hc .t-item { border-color:rgba(233,227,216,0.6); }
@media (max-width: 640px) { .t-score { top:auto; bottom:max(14px, env(safe-area-inset-bottom)); left:max(16px, env(safe-area-inset-left)); transform:none; font-size:calc(16px * var(--ui-scale)); } .t-runes { bottom:max(44px, calc(env(safe-area-inset-bottom) + 30px)); } }
`;

export class Ui {
  readonly root: HTMLElement;
  private screenEl: HTMLElement | null = null;
  private spec: ScreenSpec | null = null;
  private focus = 0;
  private openedAt = 0;
  readonly hud: HTMLElement;
  private sectorEl: HTMLElement;
  private scoreEl: HTMLElement;
  private runesEl: HTMLElement;
  private subEl: HTMLElement;
  private noticeEl: HTMLElement;
  readonly touch: HTMLElement;
  readonly blastBtn: HTMLButtonElement;
  readonly detBtn: HTMLButtonElement;
  private overlayEl: HTMLElement;
  private subTimer = 0;
  private lastSub = -1e9;
  private padPrev: boolean[] = [];
  onNav: (kind: "tick" | "confirm") => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.hud = this.el("div", "t-hud");
    this.sectorEl = this.el("div", "t-sector", this.hud);
    this.scoreEl = this.el("div", "t-score", this.hud);
    this.runesEl = this.el("div", "t-runes", this.hud);
    this.subEl = this.el("div", "t-sub-line", this.hud);
    this.noticeEl = this.el("div", "t-notice", this.hud);
    this.overlayEl = this.el("div", "t-overlay", this.hud);
    this.touch = this.el("div", "t-touch", this.hud);
    this.blastBtn = this.el("button", "t-btn small", this.touch) as HTMLButtonElement;
    this.detBtn = this.el("button", "t-btn", this.touch) as HTMLButtonElement;
    this.detBtn.innerHTML = "◈<span style='font-size:9px;margin-top:4px'>DETONATE</span>";
    this.hud.style.display = "none";
    root.appendChild(this.hud);
    window.addEventListener("keydown", this.onKey);
  }

  private el(tag: string, cls: string, parent?: HTMLElement): HTMLElement {
    const e = document.createElement(tag);
    e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  get active(): string | null {
    return this.spec?.id ?? null;
  }

  show(spec: ScreenSpec): void {
    this.hide();
    this.spec = spec;
    this.openedAt = performance.now();
    const s = this.el("section", `t-screen ${spec.className ?? ""}`);
    s.dataset.screen = spec.id;
    if (spec.title) this.el("h1", spec.id === "title" ? "t-hero" : "t-title", s).textContent = spec.title;
    if (spec.subtitle) this.el("p", "t-sub", s).textContent = spec.subtitle;
    if (spec.body) {
      const b = this.el("div", "t-body", s);
      b.innerHTML = spec.body;
    }
    const wrap = this.el("div", spec.layout === "grid" ? "t-grid" : spec.layout === "cards" ? "t-cards" : "t-list", s);
    spec.items.forEach((it, i) => {
      const b = this.el("button", "t-item", wrap) as HTMLButtonElement;
      b.dataset.id = it.id;
      b.style.transitionDelay = `${Math.min(i, 8) * 30}ms`;
      if (it.disabled) b.disabled = true;
      b.innerHTML = it.label + (it.detail ? `<span class="d">${it.detail}</span>` : "");
      b.addEventListener("pointerenter", () => {
        if (it.disabled) return;
        this.focus = this.enabled().indexOf(it);
        this.paintFocus();
      });
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (it.disabled || !this.guardOk()) return;
        this.focus = this.enabled().indexOf(it);
        this.activate();
      });
    });
    this.root.appendChild(s);
    this.screenEl = s;
    this.focus = 0;
    this.paintFocus();
    requestAnimationFrame(() => s.classList.add("on"));
  }

  hide(): void {
    this.screenEl?.remove();
    this.screenEl = null;
    this.spec = null;
  }

  /** 12 f guard after any menu opens so a gameplay press can't confirm it (GDD §8). */
  private guardOk(): boolean {
    return performance.now() - this.openedAt > 200;
  }

  private enabled(): MenuItem[] {
    return this.spec ? this.spec.items.filter((i) => !i.disabled) : [];
  }

  private paintFocus(): void {
    if (!this.screenEl) return;
    const items = this.enabled();
    const cur = items[this.focus];
    this.screenEl.querySelectorAll<HTMLButtonElement>(".t-item").forEach((b) => (b.dataset.focus = cur && b.dataset.id === cur.id ? "1" : "0"));
  }

  private move(d: number): void {
    const n = this.enabled().length;
    if (!n) return;
    this.focus = (this.focus + d + n) % n;
    this.paintFocus();
    this.onNav("tick");
  }

  private activate(): void {
    const it = this.enabled()[this.focus];
    if (!it || !this.spec) return;
    this.onNav("confirm");
    if (it.adjust) {
      it.adjust(1);
      return;
    }
    this.spec.onPick(it.id);
  }

  private adjust(dir: -1 | 1): boolean {
    const it = this.enabled()[this.focus];
    if (it?.adjust) {
      it.adjust(dir);
      this.onNav("tick");
      return true;
    }
    return false;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.spec || this.spec.id === "title") return;
    const grid = this.spec.layout === "grid" ? 5 : this.spec.layout === "cards" ? 1 : 0;
    if (e.code === "ArrowDown" || e.code === "KeyS") this.move(grid || 1);
    else if (e.code === "ArrowUp" || e.code === "KeyW") this.move(-(grid || 1));
    else if (e.code === "ArrowLeft" || e.code === "KeyA") {
      if (!this.adjust(-1) && grid) this.move(-1);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      if (!this.adjust(1) && grid) this.move(1);
    } else if ((e.code === "Enter" || e.code === "Space" || e.code === "KeyJ") && this.guardOk()) {
      e.preventDefault();
      this.activate();
    } else if ((e.code === "Escape" || e.code === "Backspace") && this.spec.onBack) {
      e.stopImmediatePropagation();
      this.spec.onBack();
    } else return;
    e.preventDefault();
  };

  /** Gamepad menu navigation (D-pad / stick, A confirm, B back). */
  pollPad(): void {
    if (!this.spec) return;
    const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
    if (!pad) return;
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const edge = (i: number) => b(i) && !this.padPrev[i];
    const grid = this.spec.layout === "grid" ? 5 : 1;
    if (edge(13)) this.move(grid);
    if (edge(12)) this.move(-grid);
    if (edge(14) && !this.adjust(-1) && this.spec.layout !== "list") this.move(-1);
    if (edge(15) && !this.adjust(1) && this.spec.layout !== "list") this.move(1);
    if ((edge(0) || (this.spec.id === "title" && pad.buttons.some((x, i) => x.pressed && !this.padPrev[i]))) && this.guardOk()) {
      if (this.spec.id === "title") this.spec.onPick("start");
      else this.activate();
    }
    if (edge(1)) this.spec.onBack?.();
    this.padPrev = pad.buttons.map((x) => x.pressed);
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  showHud(on: boolean, touch: boolean): void {
    this.hud.style.display = on ? "block" : "none";
    this.touch.classList.toggle("on", on && touch);
  }

  setHud(p: { sector: string; score: number; runes: string[]; glyphs: number }): void {
    this.sectorEl.textContent = p.sector;
    const s = p.score.toLocaleString("en-US");
    if (this.scoreEl.textContent !== s) {
      this.scoreEl.textContent = s;
      this.scoreEl.classList.add("pulse");
      requestAnimationFrame(() => requestAnimationFrame(() => this.scoreEl.classList.remove("pulse")));
    }
    const r = p.runes.join("");
    if (this.runesEl.dataset.r !== r) {
      this.runesEl.dataset.r = r;
      this.runesEl.innerHTML = p.runes.map((g) => `<span>${g}</span>`).join("");
    }
    this.blastBtn.innerHTML = `◆<span style='font-size:10px;margin-top:3px'>${p.glyphs}</span>`;
    this.blastBtn.style.opacity = p.glyphs > 0 ? "1" : "0.35";
  }

  /** Announcer subtitles: ≤ 1 line per 20 s, never interrupts another line (GDD §26). */
  subtitle(text: string, enabled: boolean, force = false): boolean {
    const now = performance.now();
    if (!force && now - this.lastSub < 20000) return false;
    this.lastSub = now;
    if (!enabled) return true;
    this.subEl.textContent = text;
    this.subEl.classList.add("on");
    clearTimeout(this.subTimer);
    this.subTimer = window.setTimeout(() => this.subEl.classList.remove("on"), 2200);
    return true;
  }

  notice(text: string): void {
    this.noticeEl.textContent = text;
    this.noticeEl.classList.add("on");
    window.setTimeout(() => this.noticeEl.classList.remove("on"), 4000);
  }

  overlay(text: string | null): void {
    this.overlayEl.textContent = text ?? "";
  }

  setScale(pct: number): void {
    document.documentElement.style.setProperty("--ui-scale", String(pct / 100));
  }
}
