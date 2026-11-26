/**
 * The QuickJS target has no DOM lib and no Node lib. Every polyfill in this
 * folder is attached through this helper so the SDK type-checks with
 * `lib: ["ES2020"]` while still working in any host engine.
 */

export type EngineScope = Record<string, unknown>;

/** The engine global object, typed loosely on purpose. */
export function engine(): EngineScope {
  return globalThis as unknown as EngineScope;
}

export function globalValue(name: string): unknown {
  return engine()[name];
}

export function hasGlobal(name: string): boolean {
  return globalValue(name) !== undefined;
}

export function defineGlobal(name: string, value: unknown): void {
  engine()[name] = value;
}

/** Installs a global only when the engine (or a previous call) lacks it. */
export function installGlobal(
  name: string,
  create: () => unknown,
  options: { force?: boolean } = {},
): unknown {
  const existing = globalValue(name);
  if (existing !== undefined && options.force !== true) return existing;
  const created = create();
  defineGlobal(name, created);
  return created;
}
