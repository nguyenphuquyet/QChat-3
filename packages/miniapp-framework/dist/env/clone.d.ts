/**
 * `structuredClone` is missing in QuickJS. This is the subset a mini app needs:
 * plain data, arrays, `Date`, `RegExp`, `Error`, `Map`, `Set`, byte buffers and
 * cyclic graphs. Functions, symbols and class instances are refused with a
 * `DataCloneError`, like the platform API.
 */
export declare class QappDataCloneError extends Error {
    constructor(message: string);
}
export declare function structuredCloneValue<T>(input: T, seen?: Map<object, unknown>): T;
export declare function installStructuredClone(): void;
//# sourceMappingURL=clone.d.ts.map