/**
 * The QuickJS target has no DOM lib and no Node lib. Every polyfill in this
 * folder is attached through this helper so the SDK type-checks with
 * `lib: ["ES2020"]` while still working in any host engine.
 */
export type EngineScope = Record<string, unknown>;
/** The engine global object, typed loosely on purpose. */
export declare function engine(): EngineScope;
export declare function globalValue(name: string): unknown;
export declare function hasGlobal(name: string): boolean;
export declare function defineGlobal(name: string, value: unknown): void;
/** Installs a global only when the engine (or a previous call) lacks it. */
export declare function installGlobal(name: string, create: () => unknown, options?: {
    force?: boolean;
}): unknown;
//# sourceMappingURL=scope.d.ts.map