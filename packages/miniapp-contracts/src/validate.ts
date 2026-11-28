/** Small, dependency-free validators shared by the host, the compiler and tests. */

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown, max = 4096): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export function isString(value: unknown, max = 4096): value is string {
  return typeof value === "string" && value.length <= max;
}

export function isInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

export function hasOnlyKeys(value: UnknownRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function hasEveryKey(value: UnknownRecord, required: readonly string[]): boolean {
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function isSemver(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && SEMVER.test(value);
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/**
 * A package path is relative, uses `/`, has no empty, `.` or `..` segment, no
 * backslash, no drive letter, no NUL and no leading slash.
 */
export function isSafePackagePath(value: unknown): value is string {
  if (!isNonEmptyString(value, 512)) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  const segments = value.split("/");
  if (segments.length === 0) return false;
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** `wx:key`-safe route: no leading slash, no `..`, no query or hash. */
export function isSafeRoute(value: unknown): value is string {
  return isSafePackagePath(value) && !value.includes("?") && !value.includes("#") && !value.endsWith(".json");
}

export function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
