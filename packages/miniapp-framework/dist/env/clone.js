/**
 * `structuredClone` is missing in QuickJS. This is the subset a mini app needs:
 * plain data, arrays, `Date`, `RegExp`, `Error`, `Map`, `Set`, byte buffers and
 * cyclic graphs. Functions, symbols and class instances are refused with a
 * `DataCloneError`, like the platform API.
 */
export class QappDataCloneError extends Error {
    constructor(message) {
        super(message);
        this.name = "DataCloneError";
    }
}
function engine() {
    return globalThis;
}
function isPlainObject(value) {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function cloneError(source) {
    const target = new Error(source.message);
    target.name = source.name;
    if (typeof source.stack === "string")
        target.stack = source.stack;
    return target;
}
function cloneBytes(source, seen) {
    const scope = engine();
    const arrayBuffer = scope.ArrayBuffer;
    if (!arrayBuffer)
        return undefined;
    const isArrayBuffer = source instanceof arrayBuffer;
    if (isArrayBuffer)
        return source.slice(0);
    if (typeof arrayBuffer.isView !== "function" || !arrayBuffer.isView(source)) {
        return undefined;
    }
    const view = source;
    const copy = view.buffer.slice(0);
    try {
        const isDataView = Object.prototype.toString.call(source) === "[object DataView]";
        if (isDataView) {
            const DataViewCtor = scope.DataView;
            return DataViewCtor
                ? new DataViewCtor(copy, 0, view.byteLength)
                : copy;
        }
        const ctor = view.constructor;
        const length = typeof view.length === "number" ? view.length : view.byteLength;
        try {
            return new ctor(copy, 0, length);
        }
        catch {
            return copy;
        }
    }
    catch {
        return undefined;
    }
}
export function structuredCloneValue(input, seen = new Map()) {
    const type = typeof input;
    if (type === "symbol")
        throw new QappDataCloneError("A symbol could not be cloned");
    if (type === "function")
        throw new QappDataCloneError("A function could not be cloned");
    if (input === null || type !== "object")
        return input;
    const source = input;
    if (seen.has(source))
        return seen.get(source);
    if (source instanceof Date)
        return new Date(source.getTime());
    if (source instanceof RegExp) {
        return new RegExp(source.source, source.flags);
    }
    if (source instanceof Error)
        return cloneError(source);
    const bytes = cloneBytes(source, seen);
    if (bytes !== undefined)
        return bytes;
    if (source instanceof Map) {
        const target = new Map();
        seen.set(source, target);
        for (const [key, value] of source) {
            target.set(structuredCloneValue(key, seen), structuredCloneValue(value, seen));
        }
        return target;
    }
    if (source instanceof Set) {
        const target = new Set();
        seen.set(source, target);
        for (const value of source)
            target.add(structuredCloneValue(value, seen));
        return target;
    }
    if (Array.isArray(source)) {
        const target = [];
        seen.set(source, target);
        for (const item of source)
            target.push(structuredCloneValue(item, seen));
        return target;
    }
    if (!isPlainObject(source)) {
        const name = source.constructor?.name;
        throw new QappDataCloneError(`${name ?? "A value"} could not be cloned`);
    }
    const target = {};
    seen.set(source, target);
    for (const key of Object.keys(source)) {
        target[key] = structuredCloneValue(source[key], seen);
    }
    return target;
}
let installed = false;
export function installStructuredClone() {
    if (installed)
        return;
    installed = true;
    engine().structuredClone = (value, _options) => structuredCloneValue(value);
}
//# sourceMappingURL=clone.js.map