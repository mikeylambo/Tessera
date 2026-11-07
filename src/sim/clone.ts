/**
 * Prototype-preserving deep clone for sim state (solver search). Handles class instances, arrays, Maps, Sets and
 * plain objects; functions are copied by reference, so owners holding closures must rebind them (see World.clone).
 */
export function deepClone<T>(value: T, memo = new Map<unknown, unknown>()): T {
  if (value === null || typeof value !== "object") return value;
  if (memo.has(value)) return memo.get(value) as T;
  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    memo.set(value, out);
    for (let i = 0; i < value.length; i++) out[i] = deepClone(value[i], memo);
    return out as T;
  }
  if (value instanceof Map) {
    const out = new Map();
    memo.set(value, out);
    for (const [k, v] of value) out.set(deepClone(k, memo), deepClone(v, memo));
    return out as T;
  }
  if (value instanceof Set) {
    const out = new Set();
    memo.set(value, out);
    for (const v of value) out.add(deepClone(v, memo));
    return out as T;
  }
  const out = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
  memo.set(value, out);
  for (const k of Object.keys(value as object)) out[k] = deepClone((value as Record<string, unknown>)[k], memo);
  return out as T;
}
