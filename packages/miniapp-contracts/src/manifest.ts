/**
 * Package manifest contract (specification section 10, ADR 008).
 *
 * A `.qxpkg` is a ZIP with `manifest.json` at the root. The manifest names the
 * app, its pages, its permissions and its default theme, and lists the SHA-256
 * of every file. The manifest itself is covered by an Ed25519 signature over its
 * canonical JSON, so verification happens before any file is executed.
 */

import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME, type ColorScheme } from "./theme.js";
import { validateDeclaredPermissions, type Permission } from "./permissions.js";
import { ERROR_CODES, miniAppError, type MiniAppError } from "./errors.js";
import { PACKAGE_FORMAT, PACKAGE_FORMAT_VERSION } from "./version.js";
import {
  hasOnlyKeys,
  isInteger,
  isNonEmptyString,
  isRecord,
  isSafePackagePath,
  isSafeRoute,
  isSemver,
  isSha256,
  type UnknownRecord,
} from "./validate.js";

export const MANIFEST_VERSION = 1 as const;

export interface ManifestFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface ManifestSignature {
  /** Signature algorithm; Ed25519 only in this version. */
  algorithm: "Ed25519";
  /** Base64 signature over the canonical manifest without `signature`. */
  value: string;
  /** Key id so a rotation can be handled without guessing. */
  keyId: string;
}

export interface MiniAppManifest {
  format: typeof PACKAGE_FORMAT;
  formatVersion: typeof PACKAGE_FORMAT_VERSION;
  appId: string;
  version: string;
  name: string;
  /** Minimum runtime version that may install this package. */
  minRuntimeVersion: string;
  /** Entry page route. */
  entry: string;
  pages: string[];
  permissions: Permission[];
  qxColorScheme: ColorScheme;
  /** Every file in the archive except `manifest.json` itself. */
  files: ManifestFile[];
  signature: ManifestSignature;
  /** Server-side metadata, not trusted for execution decisions. */
  meta?: {
    description?: string;
    icon?: string;
    categories?: string[];
  };
}

const MAX_FILES = 4096;
const MAX_PAGES = 64;
const MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
const APP_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,7}$/;

export type ManifestResult =
  | { ok: true; manifest: MiniAppManifest }
  | { ok: false; error: MiniAppError };

function bad(message: string, details?: Record<string, unknown>): ManifestResult {
  return { ok: false, error: miniAppError("MANIFEST_INVALID", message, details) };
}

/**
 * Validate an untrusted manifest. It checks shape, sizes, path safety, page
 * consistency and that every declared page and file is reachable. It does not
 * verify hashes or the signature; that is the installer's job.
 */
export function parseManifest(value: unknown): ManifestResult {
  if (!isRecord(value)) return bad("The manifest must be an object.");
  if (!hasOnlyKeys(value, [
    "format", "formatVersion", "appId", "version", "name", "minRuntimeVersion",
    "entry", "pages", "permissions", "qxColorScheme", "files", "signature", "meta",
  ])) {
    return bad("The manifest has an unknown key.");
  }
  if (value.format !== PACKAGE_FORMAT) return bad("format must be qxpkg.");
  if (value.formatVersion !== PACKAGE_FORMAT_VERSION) {
    return { ok: false, error: miniAppError("MANIFEST_VERSION_UNSUPPORTED") };
  }
  if (typeof value.appId !== "string" || !APP_ID.test(value.appId) || value.appId.length > 128) {
    return bad("appId is invalid.");
  }
  if (!isSemver(value.version)) return bad("version must be semver.");
  if (!isNonEmptyString(value.name, 64)) return bad("name is required.");
  if (!isSemver(value.minRuntimeVersion)) return bad("minRuntimeVersion must be semver.");
  if (typeof value.entry !== "string" || !isSafeRoute(value.entry)) return bad("entry is not a safe route.");

  if (!Array.isArray(value.pages) || value.pages.length === 0 || value.pages.length > MAX_PAGES) {
    return bad(`pages must contain 1-${MAX_PAGES} routes.`);
  }
  const pages: string[] = [];
  for (const page of value.pages) {
    if (typeof page !== "string" || !isSafeRoute(page)) return bad("A page route is not safe.", { page });
    if (pages.includes(page)) return bad("A page route is declared twice.", { page });
    pages.push(page);
  }
  if (!pages.includes(value.entry)) return bad("entry is not one of the declared pages.");

  const permissions = validateDeclaredPermissions(value.permissions);
  if (!permissions.ok) return bad("Unknown permission.", { unknown: permissions.unknown });

  const scheme = value.qxColorScheme ?? DEFAULT_COLOR_SCHEME;
  if (typeof scheme !== "string" || !(COLOR_SCHEMES as readonly string[]).includes(scheme)) {
    return { ok: false, error: miniAppError("THEME_INVALID_VALUE") };
  }

  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > MAX_FILES) {
    return bad(`files must contain 1-${MAX_FILES} entries.`);
  }
  const files: ManifestFile[] = [];
  const paths = new Set<string>();
  let total = 0;
  for (const item of value.files) {
    if (!isRecord(item) || !hasOnlyKeys(item, ["path", "sha256", "bytes"])) return bad("A file entry is malformed.");
    if (!isSafePackagePath(item.path)) return bad("A file path is unsafe.", { path: item.path });
    if (item.path === "manifest.json") return bad("manifest.json must not list itself.");
    if (!isSha256(item.sha256)) return bad("A file hash is not SHA-256.", { path: item.path });
    if (!isInteger(item.bytes, 0, MAX_PACKAGE_BYTES)) return bad("A file size is invalid.", { path: item.path });
    if (paths.has(item.path)) return bad("A file path is listed twice.", { path: item.path });
    paths.add(item.path);
    total += item.bytes;
    files.push({ path: item.path, sha256: item.sha256, bytes: item.bytes });
  }
  if (total > MAX_PACKAGE_BYTES) return { ok: false, error: miniAppError("PACKAGE_TOO_LARGE") };

  // Every page needs its WXML and JavaScript source in the archive, and the
  // build must have produced the compiled view bundle. A missing file is a
  // manifest error, never a runtime crash. Page JSON and WXSS are optional, as
  // in WeChat, so a page without styles or config is valid.
  for (const page of pages) {
    for (const ext of ["js", "wxml"]) {
      const path = `${page}.${ext}`;
      if (!paths.has(path)) return bad("A declared page is missing a source file.", { page, path });
    }
  }
  if (!paths.has("app.js")) return bad("app.js is missing.");
  if (!paths.has("app.json")) return bad("app.json is missing.");
  if (!paths.has("build/view.json")) return bad("The compiled view bundle build/view.json is missing.");

  const signature = value.signature;
  if (!isRecord(signature) || !hasOnlyKeys(signature, ["algorithm", "value", "keyId"])) {
    return bad("signature is malformed.");
  }
  if (signature.algorithm !== "Ed25519") return bad("signature.algorithm must be Ed25519.");
  if (!isNonEmptyString(signature.value, 512) || !isNonEmptyString(signature.keyId, 64)) {
    return bad("signature.value and signature.keyId are required.");
  }

  let meta: MiniAppManifest["meta"];
  if (value.meta !== undefined) {
    if (!isRecord(value.meta) || !hasOnlyKeys(value.meta, ["description", "icon", "categories"])) {
      return bad("meta is malformed.");
    }
    if (value.meta.description !== undefined && !isNonEmptyString(value.meta.description, 512)) {
      return bad("meta.description is too long.");
    }
    if (value.meta.icon !== undefined && !isSafePackagePath(value.meta.icon)) return bad("meta.icon is unsafe.");
    if (value.meta.categories !== undefined) {
      if (!Array.isArray(value.meta.categories) || value.meta.categories.length > 8) return bad("meta.categories is invalid.");
      if (!value.meta.categories.every((entry) => isNonEmptyString(entry, 32))) return bad("meta.categories is invalid.");
    }
    meta = value.meta as MiniAppManifest["meta"];
  }

  const manifest: MiniAppManifest = {
    format: PACKAGE_FORMAT,
    formatVersion: PACKAGE_FORMAT_VERSION,
    appId: value.appId,
    version: value.version,
    name: value.name,
    minRuntimeVersion: value.minRuntimeVersion,
    entry: value.entry,
    pages,
    permissions: permissions.permissions,
    qxColorScheme: scheme as ColorScheme,
    files,
    signature: {
      algorithm: "Ed25519",
      value: signature.value as string,
      keyId: signature.keyId as string,
    },
    ...(meta ? { meta } : {}),
  };
  return { ok: true, manifest };
}

/** The bytes that are signed: the manifest without its `signature` field. */
export function signableManifest(manifest: MiniAppManifest): UnknownRecord {
  const { signature: _signature, ...rest } = manifest;
  return rest as UnknownRecord;
}

/**
 * Canonical JSON: object keys sorted, no insignificant whitespace. Two
 * independent implementations must produce the same bytes or a signature
 * verifies in one place and not in another.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const record = value as UnknownRecord;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

/** True when the installed runtime satisfies the package's minimum version. */
export function satisfiesRuntime(minRuntimeVersion: string, runtimeVersion: string): boolean {
  const parse = (value: string): number[] => value.split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10));
  const required = parse(minRuntimeVersion);
  const current = parse(runtimeVersion);
  for (let index = 0; index < 3; index += 1) {
    const left = required[index] ?? 0;
    const right = current[index] ?? 0;
    if (right > left) return true;
    if (right < left) return false;
  }
  return true;
}

export { ERROR_CODES };
