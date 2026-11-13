import * as THREE from "three";
import { paramKind } from "../../tuning/Tunables.js";
/**
 * Binds a tunable group to shader uniforms shared by every material instance of one semantic ID.
 * numbers → float, colors (token or hex) → Color, bools → float 0/1, enums → int index.
 */
export class TunedUniforms {
    group;
    schema;
    registry;
    palette;
    uniforms = {};
    values;
    hooks = [];
    constructor(group, schema, registry, palette, prefix = "u_") {
        this.group = group;
        this.schema = schema;
        this.registry = registry;
        this.palette = palette;
        this.values = registry.define(group, schema);
        for (const key of Object.keys(schema))
            this.uniforms[prefix + key] = { value: paramKind(schema[key]) === "color" ? new THREE.Color() : 0 };
        this.prefix = prefix;
        this.sync();
        registry.subscribe((c) => { if (c.group === group)
            this.sync(); });
        palette.onChange(() => this.sync());
    }
    prefix;
    /** Run extra side effects (e.g. material.normalScale) whenever values change. */
    onSync(hook) { this.hooks.push(hook); hook(); return this; }
    num(key) { return Number(this.values[key]); }
    str(key) { return String(this.values[key]); }
    color(key, target = new THREE.Color()) { return target.set(this.palette.resolve(this.str(key))); }
    sync() {
        for (const [key, param] of Object.entries(this.schema)) {
            const u = this.uniforms[this.prefix + key];
            const v = this.registry.get(this.group, key);
            const kind = paramKind(param);
            if (kind === "color")
                u.value.set(this.palette.resolve(String(v)));
            else if (kind === "bool")
                u.value = v ? 1 : 0;
            else if (kind === "enum")
                u.value = Math.max(0, param.options.indexOf(String(v)));
            else
                u.value = Number(v);
        }
        for (const hook of this.hooks)
            hook();
    }
    /** GLSL uniform declarations for this group. */
    glsl() {
        return Object.entries(this.schema).map(([key, p]) => {
            const kind = paramKind(p);
            return `uniform ${kind === "color" ? "vec3" : kind === "enum" ? "int" : "float"} ${this.prefix}${key};`;
        }).join("\n");
    }
}
