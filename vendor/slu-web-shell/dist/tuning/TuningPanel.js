import { paramKind, tunables as defaultRegistry } from "./Tunables.js";
const CSS = `
.slu-tune{position:fixed;top:0;right:0;bottom:0;width:min(380px,92vw);z-index:2147483000;display:flex;flex-direction:column;
 background:rgba(8,9,18,.94);color:#dfe6ff;font:12px/1.35 ui-sans-serif,system-ui,sans-serif;border-left:1px solid #2a2f52;
 backdrop-filter:blur(8px);transform:translateX(102%);transition:transform .16s ease-out;padding-right:env(safe-area-inset-right)}
.slu-tune[data-open="1"]{transform:none}
.slu-tune header{display:flex;gap:6px;padding:8px;border-bottom:1px solid #2a2f52;flex-wrap:wrap}
.slu-tune input[type=search]{flex:1 1 100%;background:#12142a;border:1px solid #2a2f52;color:inherit;padding:6px 8px;border-radius:6px}
.slu-tune button,.slu-tune select{background:#191c38;border:1px solid #333a6b;color:inherit;border-radius:6px;padding:5px 8px;cursor:pointer;font:inherit}
.slu-tune :focus-visible{outline:2px solid #5ff2ff;outline-offset:1px}
.slu-tune .body{overflow:auto;flex:1;padding:4px 0 24px}
.slu-tune details{border-bottom:1px solid #1d2142}
.slu-tune summary{display:flex;align-items:center;gap:6px;padding:7px 10px;cursor:pointer;font-weight:600;letter-spacing:.02em}
.slu-tune summary .dirty{color:#ff9a4d}
.slu-tune summary span.grow{flex:1}
.slu-tune .row{display:grid;grid-template-columns:118px 1fr 52px;gap:6px;align-items:center;padding:3px 10px}
.slu-tune .row[data-dirty="1"] label{color:#ff9a4d}
.slu-tune .row label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slu-tune .row input[type=range]{width:100%;accent-color:#5ff2ff}
.slu-tune .row output{text-align:right;font-variant-numeric:tabular-nums;opacity:.8}
.slu-tune .row input[type=color]{width:100%;height:22px;border:0;background:none;padding:0}
.slu-tune .status{padding:6px 10px;border-top:1px solid #2a2f52;min-height:1.4em;opacity:.8}
`;
export function mountTuningPanel(options = {}) {
    const registry = options.registry ?? defaultRegistry;
    const endpoint = options.endpoint ?? "/__slu/tuning";
    const resolveColor = options.resolveColor ?? ((v) => (v.startsWith("#") ? v : "#ffffff"));
    const doc = (options.root ?? document.body).ownerDocument;
    if (!doc.getElementById("slu-tune-css")) {
        const style = doc.createElement("style");
        style.id = "slu-tune-css";
        style.textContent = CSS;
        doc.head.appendChild(style);
    }
    const el = doc.createElement("aside");
    el.className = "slu-tune";
    el.setAttribute("aria-label", "Tuning");
    el.innerHTML = `<header><input type="search" placeholder="Search" aria-label="Search parameters">
    <button data-act="save">Save</button><button data-act="saveas">Save As</button>
    <button data-act="load">Load</button><button data-act="diff">Diff vs canon</button></header>
    <div class="body"></div><div class="status" role="status"></div>`;
    (options.root ?? doc.body).appendChild(el);
    const body = el.querySelector(".body");
    const search = el.querySelector("input[type=search]");
    const status = el.querySelector(".status");
    let diffOnly = false;
    let activeGroup = null;
    const openGroups = new Set();
    const say = (text) => { status.textContent = text; };
    function render() {
        const query = search.value.trim().toLowerCase();
        body.textContent = "";
        for (const group of registry.list()) {
            const schema = registry.schema(group);
            const dirty = new Set(registry.diff(group).map((d) => d.key));
            const keys = Object.keys(schema).filter((k) => (!query || `${group}.${k}`.toLowerCase().includes(query)) && (!diffOnly || dirty.has(k)));
            if (!keys.length)
                continue;
            const details = doc.createElement("details");
            details.open = openGroups.has(group) || !!query || diffOnly;
            details.addEventListener("toggle", () => { details.open ? openGroups.add(group) : openGroups.delete(group); });
            details.addEventListener("focusin", () => { activeGroup = group; });
            const summary = doc.createElement("summary");
            summary.innerHTML = `<span class="grow"></span>${dirty.size ? `<span class="dirty">●${dirty.size}</span>` : ""}`;
            summary.firstChild.textContent = group;
            const reset = doc.createElement("button");
            reset.textContent = "Reset";
            reset.title = "Reset group to canon";
            reset.addEventListener("click", (e) => { e.preventDefault(); registry.reset(group); render(); });
            summary.appendChild(reset);
            details.appendChild(summary);
            for (const key of keys) {
                const param = schema[key];
                const value = registry.get(group, key);
                const row = doc.createElement("div");
                row.className = "row";
                row.dataset.dirty = dirty.has(key) ? "1" : "0";
                const label = doc.createElement("label");
                label.textContent = param.label ?? key;
                label.title = `${group}.${key}`;
                const out = doc.createElement("output");
                let input;
                const kind = paramKind(param);
                if (kind === "number") {
                    const p = param;
                    const r = doc.createElement("input");
                    r.type = "range";
                    r.min = String(p.min);
                    r.max = String(p.max);
                    r.step = String(p.step ?? (p.max - p.min) / 200);
                    r.value = String(value);
                    out.textContent = fmt(value);
                    r.addEventListener("input", () => { const v = registry.set(group, key, Number(r.value)); out.textContent = fmt(v); row.dataset.dirty = "1"; });
                    input = r;
                }
                else if (kind === "color") {
                    const wrap = doc.createElement("div");
                    wrap.style.display = "flex";
                    wrap.style.gap = "4px";
                    const c = doc.createElement("input");
                    c.type = "color";
                    c.value = resolveColor(String(value));
                    const tokens = options.colorTokens?.() ?? [];
                    if (tokens.length) {
                        const sel = doc.createElement("select");
                        sel.innerHTML = `<option value="">hex</option>` + tokens.map((t) => `<option>${t}</option>`).join("");
                        sel.value = tokens.includes(String(value)) ? String(value) : "";
                        sel.addEventListener("change", () => { if (sel.value) {
                            registry.set(group, key, sel.value);
                            c.value = resolveColor(sel.value);
                            out.textContent = sel.value;
                            row.dataset.dirty = "1";
                        } });
                        wrap.appendChild(sel);
                    }
                    c.addEventListener("input", () => { registry.set(group, key, c.value); out.textContent = c.value; row.dataset.dirty = "1"; });
                    wrap.prepend(c);
                    out.textContent = String(value);
                    row.append(label, wrap, out);
                    details.appendChild(row);
                    continue;
                }
                else if (kind === "bool") {
                    const b = doc.createElement("input");
                    b.type = "checkbox";
                    b.checked = value;
                    b.addEventListener("change", () => { registry.set(group, key, b.checked); row.dataset.dirty = "1"; });
                    input = b;
                }
                else {
                    const s = doc.createElement("select");
                    s.innerHTML = param.options.map((o) => `<option>${o}</option>`).join("");
                    s.value = String(value);
                    s.addEventListener("change", () => { registry.set(group, key, s.value); row.dataset.dirty = "1"; });
                    input = s;
                }
                input.setAttribute("aria-label", `${group} ${key}`);
                row.append(label, input, out);
                details.appendChild(row);
            }
            body.appendChild(details);
        }
    }
    async function save(group, name) {
        const preset = registry.toPreset(group, name);
        const file = `${group}${name ? `.${name}` : ""}.json`;
        try {
            const res = await fetch(`${endpoint}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file, preset }) });
            if (!res.ok)
                throw new Error(String(res.status));
            if (!name)
                registry.commitCanon(group);
            say(`Saved tuning/${file}`);
        }
        catch {
            const a = doc.createElement("a");
            a.href = URL.createObjectURL(new Blob([JSON.stringify(preset, null, 2) + "\n"], { type: "application/json" }));
            a.download = file;
            a.click();
            URL.revokeObjectURL(a.href);
            say(`Downloaded ${file} — move it into tuning/`);
        }
        render();
    }
    async function load() {
        try {
            const files = await (await fetch(`${endpoint}/list`)).json();
            const choice = prompt(`Load which preset?\n${files.join("\n")}`, files[0] ?? "");
            if (!choice)
                return;
            const preset = await (await fetch(`${endpoint}/file?name=${encodeURIComponent(choice)}`)).json();
            const ignored = registry.applyPreset(preset);
            say(`Loaded ${choice}${ignored.length ? ` (ignored: ${ignored.join(", ")})` : ""}`);
        }
        catch {
            const input = doc.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async () => { const f = input.files?.[0]; if (!f)
                return; registry.applyPreset(JSON.parse(await f.text())); say(`Loaded ${f.name}`); render(); };
            input.click();
        }
        render();
    }
    const targetGroup = () => activeGroup ?? registry.list().find((g) => openGroups.has(g)) ?? null;
    el.querySelector("header").addEventListener("click", (e) => {
        const act = e.target.dataset.act;
        if (!act)
            return;
        const group = targetGroup();
        if (act === "diff") {
            diffOnly = !diffOnly;
            say(diffOnly ? "Showing changes vs canon" : "");
            render();
            return;
        }
        if (act === "load") {
            void load();
            return;
        }
        if (!group) {
            say("Focus a group first");
            return;
        }
        if (act === "save")
            void save(group);
        if (act === "saveas") {
            const name = prompt("Variant name", "variant");
            if (name)
                void save(group, name.replace(/[^\w-]+/g, "-"));
        }
    });
    search.addEventListener("input", render);
    const open = () => el.dataset.open === "1";
    function toggle(force) {
        el.dataset.open = (force ?? !open()) ? "1" : "0";
        if (open()) {
            render();
            el.querySelector("summary")?.focus();
        }
    }
    const onKey = (e) => {
        if (e.code === "Backquote") {
            e.preventDefault();
            toggle();
            return;
        }
        if (!open() || !el.contains(doc.activeElement))
            return;
        if (e.key === "Escape")
            toggle(false);
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (doc.activeElement.tagName === "SELECT")
                return;
            e.preventDefault();
            moveFocus(e.key === "ArrowDown" ? 1 : -1);
        }
    };
    function focusables() {
        return [...el.querySelectorAll("summary, input, select, button")].filter((n) => n.offsetParent !== null);
    }
    function moveFocus(dir) {
        const list = focusables();
        const i = list.indexOf(doc.activeElement);
        list[(i + dir + list.length) % list.length]?.focus();
    }
    // Gamepad: reuse the shell's semantic navigation idea with edge-triggered polling.
    let prev = [];
    let raf = 0;
    const poll = () => {
        raf = requestAnimationFrame(poll);
        const pad = typeof navigator !== "undefined" ? navigator.getGamepads?.().find((p) => p) : null;
        if (!pad)
            return;
        const b = pad.buttons.map((x) => x.pressed);
        const edge = (i) => b[i] && !prev[i];
        if (edge(8) || (edge(9) && b[8]))
            toggle(); // View/Back toggles
        if (open()) {
            if (edge(12))
                moveFocus(-1);
            if (edge(13))
                moveFocus(1);
            if (edge(1))
                toggle(false);
            const a = doc.activeElement;
            if (edge(0) && a && el.contains(a))
                a.click();
            if ((b[14] || b[15]) && a instanceof HTMLInputElement && a.type === "range") {
                const step = Number(a.step) || 0.01;
                a.value = String(Number(a.value) + (b[15] ? step : -step));
                a.dispatchEvent(new Event("input"));
            }
        }
        prev = b;
    };
    raf = requestAnimationFrame(poll);
    doc.addEventListener("keydown", onKey);
    const unsub = registry.subscribe(() => { });
    if (options.startOpen)
        toggle(true);
    return {
        element: el, toggle, refresh: render,
        dispose() { cancelAnimationFrame(raf); doc.removeEventListener("keydown", onKey); unsub(); el.remove(); }
    };
}
function fmt(n) { return Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2); }
