/**
 * `structuredClone` is missing in QuickJS. This is the subset a mini app needs:
 * plain data, arrays, `Date`, `RegExp`, `Error`, `Map`, `Set`, byte buffers and
 * cyclic graphs. Functions, symbols and class instances are refused with a
 * `DataCloneError`, like the platform API.
 */

export class QappDataCloneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataCloneError";
  }
}

type AnyRecord = Record<string, unknown>;

function engine(): AnyRecord {
  return globalThis as unknown as AnyRecord;
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function cloneError(source: Error): Error {
  const target = new Error(source.message);
  target.name = source.name;
  if (typeof source.stack === "string") target.stack = source.stack;
  return target;
}

function cloneBytes(source: unknown, seen: Map<object, unknown>): unknown {
  const scope = engine();
  const arrayBuffer = scope.ArrayBuffer as
    | { isView(value: unknown): boolean; new (length: number): ArrayBuffer }
    | undefined;
  if (!arrayBuffer) return undefined;
  const isArrayBuffer = source instanceof (arrayBuffer as unknown as new () => object);
  if (isArrayBuffer) return (source as ArrayBuffer).slice(0);
  if (typeof arrayBuffer.isView !== "function" || !arrayBuffer.isView(source)) {
    return undefined;
  }
  const view = source as unknown as {
    buffer: ArrayBuffer;
    byteOffset: number;
    byteLength: number;
    constructor: { new (buffer: ArrayBuffer, byteOffset: number, length: number): unknown };
    length?: number;
  };
  const copy = view.buffer.slice(0);
  try {
    const isDataView = Object.prototype.toString.call(source) === "[object DataView]";
    if (isDataView) {
      const DataViewCtor = scope.DataView as
        | { new (buffer: ArrayBuffer, byteOffset: number, byteLength: number): unknown }
        | undefined;
      return DataViewCtor
        ? new DataViewCtor(copy, 0, view.byteLength)
        : copy;
    }
    const ctor = view.constructor as { new (buffer: ArrayBuffer, byteOffset: number, length: number): unknown };
    const length = typeof view.length === "number" ? view.length : view.byteLength;
    try {
      return new ctor(copy, 0, length);
    } catch {
      return copy;
    }
  } catch {
    return undefined;
  }
}

export function structuredCloneValue<T>(
  input: T,
  seen: Map<object, unknown> = new Map(),
): T {
  const type = typeof input;
  if (type === "symbol") throw new QappDataCloneError("A symbol could not be cloned");
  if (type === "function") throw new QappDataCloneError("A function could not be cloned");
  if (input === null || type !== "object") return input;
  const source = input as unknown as object;
  if (seen.has(source)) return seen.get(source) as T;

  if (source instanceof Date) return new Date(source.getTime()) as unknown as T;
  if (source instanceof RegExp) {
    return new RegExp(source.source, source.flags) as unknown as T;
  }
  if (source instanceof Error) return cloneError(source) as unknown as T;
  const bytes = cloneBytes(source, seen);
  if (bytes !== undefined) return bytes as T;
  if (source instanceof Map) {
    const target = new Map<unknown, unknown>();
    seen.set(source, target);
    for (const [key, value] of source) {
      target.set(structuredCloneValue(key, seen), structuredCloneValue(value, seen));
    }
    return target as unknown as T;
  }
  if (source instanceof Set) {
    const target = new Set<unknown>();
    seen.set(source, target);
    for (const value of source) target.add(structuredCloneValue(value, seen));
    return target as unknown as T;
  }
  if (Array.isArray(source)) {
    const target: unknown[] = [];
    seen.set(source, target);
    for (const item of source) target.push(structuredCloneValue(item, seen));
    return target as unknown as T;
  }
  if (!isPlainObject(source)) {
    const name = (source as { constructor?: { name?: string } }).constructor?.name;
    throw new QappDataCloneError(`${name ?? "A value"} could not be cloned`);
  }
  const target: AnyRecord = {};
  seen.set(source, target);
  for (const key of Object.keys(source as AnyRecord)) {
    target[key] = structuredCloneValue((source as AnyRecord)[key], seen);
  }
  return target as unknown as T;
}

let installed = false;

export function installStructuredClone(): void {
  if (installed) return;
  installed = true;
  engine().structuredClone = <T>(value: T, _options?: unknown): T =>
    structuredCloneValue(value);
}
