/**
 * The QuickJS target has no DOM lib and no Node lib. Every polyfill in this
 * folder is attached through this helper so the SDK type-checks with
 * `lib: ["ES2020"]` while still working in any host engine.
 */
/** The engine global object, typed loosely on purpose. */
export function engine() {
    return globalThis;
}
export function globalValue(name) {
    return engine()[name];
}
export function hasGlobal(name) {
    return globalValue(name) !== undefined;
}
export function defineGlobal(name, value) {
    engine()[name] = value;
}
/** Installs a global only when the engine (or a previous call) lacks it. */
export function installGlobal(name, create, options = {}) {
    const existing = globalValue(name);
    if (existing !== undefined && options.force !== true)
        return existing;
    const created = create();
    defineGlobal(name, created);
    return created;
}
//# sourceMappingURL=scope.js.map