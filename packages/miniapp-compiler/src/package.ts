/**
 * `.qxpkg` writer and verifier (specification section 10, ADR 008).
 *
 * The container is a ZIP with `manifest.json`, `signature.ed25519` and the
 * package files. The manifest lists every file with its SHA-256 and byte size;
 * its Ed25519 signature covers the canonical manifest without the `signature`
 * field. Verification order is the one ADR 008 fixes: size, ZIP structure,
 * manifest schema, signature, then every file hash before anything is written.
 *
 * This module is the Node reference implementation. Android and iOS implement
 * the same format; the fixed vectors in `test/package.test.ts` keep them honest.
 */

import {
  createHash,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import {
  PACKAGE_FORMAT,
  PACKAGE_FORMAT_VERSION,
  canonicalJson,
  isSafePackagePath,
  miniAppError,
  parseManifest,
  signableManifest,
  type MiniAppError,
  type MiniAppManifest,
  type Permission,
} from "@qchat/miniapp-contracts";

export const MANIFEST_FILE = "manifest.json";
export const SIGNATURE_FILE = "signature.ed25519";

export interface PackageLimits {
  /** Whole archive bytes. */
  maxArchiveBytes: number;
  /** One uncompressed file. */
  maxEntryBytes: number;
  /** All uncompressed files together. */
  maxTotalBytes: number;
  maxEntries: number;
}

export const DEFAULT_PACKAGE_LIMITS: PackageLimits = {
  maxArchiveBytes: 48 * 1024 * 1024,
  maxEntryBytes: 32 * 1024 * 1024,
  maxTotalBytes: 32 * 1024 * 1024,
  maxEntries: 4096,
};

/**
 * Extensions a package may contain. Executables, native libraries, scripts and
 * archives are rejected even if the manifest would otherwise accept the path.
 */
const ALLOWED_EXTENSIONS = new Set([
  "js",
  "mjs",
  "json",
  "wxml",
  "wxss",
  "wxs",
  "html",
  "htm",
  "css",
  "map",
  "txt",
  "md",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "mp3",
  "wav",
  "mp4",
  "webm",
  "ed25519",
]);

export class PackageError extends Error {
  constructor(readonly error: MiniAppError) {
    super(error.message);
    this.name = "PackageError";
  }
}

export interface PackageFileInput {
  path: string;
  bytes: Uint8Array;
}

export interface CreatePackageOptions {
  appId: string;
  version: string;
  name: string;
  minRuntimeVersion: string;
  /** Defaults to the `qxColorScheme` in `app.json`, then `light`. */
  qxColorScheme?: "light" | "dark" | "auto";
  /** Defaults to the first page in `app.json`. */
  entry?: string;
  permissions?: readonly Permission[];
  meta?: MiniAppManifest["meta"];
  keyId: string;
  privateKey: KeyObject | string;
  limits?: Partial<PackageLimits>;
}

export interface CreatedPackage {
  bytes: Buffer;
  manifest: MiniAppManifest;
}

export interface VerifiedPackage {
  manifest: MiniAppManifest;
  files: Map<string, Buffer>;
}

export type PackageResult<T> = { ok: true; value: T } | { ok: false; error: MiniAppError };

function limitsOf(input?: Partial<PackageLimits>): PackageLimits {
  return { ...DEFAULT_PACKAGE_LIMITS, ...input };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  bytes: Buffer;
  method: number;
  crc: number;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CD = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const UTF8_FLAG = 0x0800;

function fail(code: MiniAppError["code"], message?: string): PackageError {
  return new PackageError(miniAppError(code, message));
}

export function isAllowedPackageFile(path: string): boolean {
  if (!isSafePackagePath(path)) return false;
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS.has(extension);
}

function checkName(name: string): void {
  if (!isSafePackagePath(name)) throw fail("PACKAGE_UNSAFE_PATH", `Unsafe package path: ${JSON.stringify(name)}.`);
  if (!isAllowedPackageFile(name)) {
    throw fail("PACKAGE_FORMAT_UNSUPPORTED", `Unsupported package file type: ${JSON.stringify(name)}.`);
  }
}

function makeZip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.method === 8 ? deflateRawSync(entry.bytes) : entry.bytes;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(SIG_CD, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG_EOCD, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, directory, end]);
}

function findEocd(buffer: Buffer): number {
  const stop = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= stop; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== SIG_EOCD) continue;
    const comment = buffer.readUInt16LE(offset + 20);
    if (offset + 22 + comment === buffer.length) return offset;
  }
  throw fail("PACKAGE_FORMAT_UNSUPPORTED", "The archive has no ZIP end record.");
}

function readZip(buffer: Buffer, limits: PackageLimits): ZipEntry[] {
  if (buffer.length > limits.maxArchiveBytes) throw fail("PACKAGE_TOO_LARGE");
  const eocd = findEocd(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (count === 0) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "The archive is empty.");
  if (count > limits.maxEntries) throw fail("PACKAGE_TOO_LARGE", "Too many files.");
  if (count === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    throw fail("PACKAGE_FORMAT_UNSUPPORTED", "ZIP64 is not supported.");
  }
  if (directoryOffset + directorySize > eocd) throw fail("PACKAGE_FORMAT_UNSUPPORTED");

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  let offset = directoryOffset;

  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== SIG_CD) {
      throw fail("PACKAGE_FORMAT_UNSUPPORTED", "The central directory is malformed.");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const checksum = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    if (offset + 46 + nameLength + extraLength + commentLength > buffer.length) {
      throw fail("PACKAGE_FORMAT_UNSUPPORTED");
    }
    const rawName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "Encrypted entries are not supported.");
    if (method !== 0 && method !== 8) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "Unsupported ZIP compression.");
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw fail("PACKAGE_FORMAT_UNSUPPORTED", "ZIP64 is not supported.");
    }
    const directory = rawName.endsWith("/");
    if (directory) {
      if (!isSafePackagePath(rawName.slice(0, -1))) throw fail("PACKAGE_UNSAFE_PATH");
      continue;
    }
    checkName(rawName);
    const key = rawName.toLowerCase();
    if (seen.has(key)) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "A file is listed twice.");
    seen.add(key);
    if (uncompressedSize > limits.maxEntryBytes) throw fail("PACKAGE_TOO_LARGE", "A file is too large.");

    const mode = (externalAttributes >>> 16) & 0xffff;
    if (mode && (mode & 0xf000) === 0xa000) throw fail("PACKAGE_UNSAFE_PATH", "Symbolic links are not allowed.");

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== SIG_LOCAL) {
      throw fail("PACKAGE_FORMAT_UNSUPPORTED", "A local header is missing.");
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > buffer.length) throw fail("PACKAGE_FORMAT_UNSUPPORTED");
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    let bytes: Buffer;
    if (method === 0) {
      bytes = Buffer.from(raw);
    } else {
      const remaining = limits.maxTotalBytes - total;
      const cap = Math.min(limits.maxEntryBytes, Math.max(remaining, 0)) + 1;
      try {
        bytes = inflateRawSync(raw, { maxOutputLength: cap });
      } catch {
        throw fail("PACKAGE_FORMAT_UNSUPPORTED", "A compressed file could not be inflated.");
      }
    }
    if (bytes.length !== uncompressedSize) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "A file size is wrong.");
    if (crc32(bytes) !== checksum) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "A CRC check failed.");
    total += bytes.length;
    if (total > limits.maxTotalBytes) throw fail("PACKAGE_TOO_LARGE");
    entries.push({ name: rawName, bytes, method, crc: checksum });
  }
  return entries;
}

function parseAppJson(files: readonly PackageFileInput[]): {
  pages: string[];
  qxColorScheme?: "light" | "dark" | "auto";
  title?: string;
} {
  const app = files.find((file) => file.path === "app.json");
  if (!app) throw fail("MANIFEST_INVALID", "app.json is missing.");
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(app.bytes).toString("utf8"));
  } catch {
    throw fail("MANIFEST_INVALID", "app.json is not valid JSON.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw fail("MANIFEST_INVALID", "app.json must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.pages) || record.pages.length === 0) {
    throw fail("MANIFEST_INVALID", "app.json must declare pages.");
  }
  const pages: string[] = [];
  for (const page of record.pages) {
    if (typeof page !== "string") throw fail("MANIFEST_INVALID", "A page route must be a string.");
    pages.push(page);
  }
  const scheme = record.qxColorScheme;
  const qxColorScheme =
    scheme === "light" || scheme === "dark" || scheme === "auto" ? scheme : undefined;
  const window = record.window;
  const title =
    typeof window === "object" && window !== null && typeof (window as Record<string, unknown>).navigationBarTitleText === "string"
      ? ((window as Record<string, unknown>).navigationBarTitleText as string)
      : undefined;
  return { pages, qxColorScheme, title };
}

/**
 * Build a signed `.qxpkg`. The manifest is derived from `app.json` and the
 * supplied metadata; every file is hashed before the manifest is signed, so a
 * caller cannot sign a package that does not match its manifest.
 */
export function createPackage(
  files: readonly PackageFileInput[],
  options: CreatePackageOptions,
): PackageResult<CreatedPackage> {
  try {
    const limits = limitsOf(options.limits);
    const seen = new Set<string>();
    const inputs: PackageFileInput[] = [];
    for (const file of files) {
      if (file.path === MANIFEST_FILE || file.path === SIGNATURE_FILE) {
        throw fail("MANIFEST_INVALID", `${file.path} is written by the packager.`);
      }
      checkName(file.path);
      if (seen.has(file.path.toLowerCase())) throw fail("MANIFEST_INVALID", "A file path is listed twice.");
      seen.add(file.path.toLowerCase());
      inputs.push({ path: file.path, bytes: Buffer.from(file.bytes) });
    }
    inputs.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

    const app = parseAppJson(inputs);
    const entry = options.entry ?? app.pages[0];
    const manifestFiles = inputs.map((file) => ({
      path: file.path,
      sha256: sha256Hex(file.bytes),
      bytes: file.bytes.length,
    }));

    const signable = {
      format: PACKAGE_FORMAT,
      formatVersion: PACKAGE_FORMAT_VERSION,
      appId: options.appId,
      version: options.version,
      name: options.name || app.title || options.appId,
      minRuntimeVersion: options.minRuntimeVersion,
      entry,
      pages: app.pages,
      permissions: [...(options.permissions ?? [])],
      qxColorScheme: options.qxColorScheme ?? app.qxColorScheme ?? "light",
      files: manifestFiles,
      ...(options.meta ? { meta: options.meta } : {}),
    };
    const signature = cryptoSign(
      null,
      Buffer.from(canonicalJson(signable), "utf8"),
      options.privateKey,
    );
    const manifest: MiniAppManifest = {
      ...signable,
      signature: {
        algorithm: "Ed25519",
        value: signature.toString("base64"),
        keyId: options.keyId,
      },
    };

    const parsed = parseManifest(manifest);
    if (!parsed.ok) return parsed;

    const entries: ZipEntry[] = [];
    const push = (name: string, bytes: Buffer): void => {
      const compressed = deflateRawSync(bytes);
      const method = compressed.length < bytes.length ? 8 : 0;
      entries.push({ name, bytes, method, crc: crc32(bytes) });
    };
    push(MANIFEST_FILE, Buffer.from(JSON.stringify(parsed.manifest), "utf8"));
    push(SIGNATURE_FILE, signature);
    for (const file of inputs) push(file.path, Buffer.from(file.bytes));

    const archive = makeZip(entries);
    if (archive.length > limits.maxArchiveBytes) throw fail("PACKAGE_TOO_LARGE");
    return { ok: true, value: { bytes: archive, manifest: parsed.manifest } };
  } catch (cause) {
    return { ok: false, error: cause instanceof PackageError ? cause.error : miniAppError("PACKAGE_INSTALL_FAILED", String(cause)) };
  }
}

export interface VerifyPackageOptions {
  /** Public keys by `keyId`. An unknown key id is a signature failure. */
  publicKeys: Readonly<Record<string, KeyObject | string>>;
  /** The runtime version used for the `minRuntimeVersion` check. */
  runtimeVersion: string;
  limits?: Partial<PackageLimits>;
}

/**
 * Verify a package without writing anything. The caller receives the manifest
 * and the verified file bytes only when every check passed.
 */
export function verifyPackage(bytes: Uint8Array, options: VerifyPackageOptions): PackageResult<VerifiedPackage> {
  try {
    const limits = limitsOf(options.limits);
    const archive = Buffer.from(bytes);
    const entries = readZip(archive, limits);

    const manifestEntries = entries.filter((entry) => entry.name === MANIFEST_FILE);
    if (manifestEntries.length !== 1) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "manifest.json is missing or duplicated.");
    const signatureEntries = entries.filter((entry) => entry.name === SIGNATURE_FILE);
    if (signatureEntries.length !== 1) throw fail("PACKAGE_FORMAT_UNSUPPORTED", "signature.ed25519 is missing or duplicated.");

    let raw: unknown;
    try {
      raw = JSON.parse(manifestEntries[0].bytes.toString("utf8"));
    } catch {
      throw fail("MANIFEST_INVALID", "manifest.json is not valid JSON.");
    }
    const parsed = parseManifest(raw);
    if (!parsed.ok) return parsed;
    const manifest = parsed.manifest;

    const key = options.publicKeys[manifest.signature.keyId];
    if (!key) throw fail("PACKAGE_SIGNATURE_INVALID", "The signing key is not trusted.");
    let signature: Buffer;
    try {
      signature = Buffer.from(manifest.signature.value, "base64");
    } catch {
      throw fail("PACKAGE_SIGNATURE_INVALID", "The signature is not base64.");
    }
    if (signature.length !== 64) throw fail("PACKAGE_SIGNATURE_INVALID", "An Ed25519 signature must be 64 bytes.");
    // The detached file is the copy the host reads before parsing the manifest;
    // if the two disagree, one of them was edited.
    if (signatureEntries[0].bytes.length !== 64 || !signatureEntries[0].bytes.equals(signature)) {
      throw fail("PACKAGE_SIGNATURE_INVALID", "signature.ed25519 does not match the manifest signature.");
    }
    let valid = false;
    try {
      valid = cryptoVerify(
        null,
        Buffer.from(canonicalJson(signableManifest(manifest)), "utf8"),
        key,
        signature,
      );
    } catch {
      valid = false;
    }
    if (!valid) throw fail("PACKAGE_SIGNATURE_INVALID");

    const content = new Map<string, Buffer>();
    for (const entry of entries) {
      if (entry.name === MANIFEST_FILE || entry.name === SIGNATURE_FILE) continue;
      content.set(entry.name, entry.bytes);
    }
    if (content.size !== manifest.files.length) {
      throw fail("PACKAGE_HASH_MISMATCH", "The archive and the manifest list different files.");
    }
    let total = 0;
    for (const file of manifest.files) {
      const actual = content.get(file.path);
      if (!actual) throw fail("PACKAGE_HASH_MISMATCH", `A manifest file is missing: ${file.path}.`);
      if (actual.length !== file.bytes) throw fail("PACKAGE_HASH_MISMATCH", `A file size does not match: ${file.path}.`);
      if (sha256Hex(actual) !== file.sha256) throw fail("PACKAGE_HASH_MISMATCH", `A file hash does not match: ${file.path}.`);
      total += actual.length;
    }
    if (total > limits.maxTotalBytes) throw fail("PACKAGE_TOO_LARGE");

    if (!satisfiesRuntimeVersion(manifest.minRuntimeVersion, options.runtimeVersion)) {
      throw fail("PACKAGE_FORMAT_UNSUPPORTED", "The package requires a newer runtime.");
    }
    return { ok: true, value: { manifest, files: content } };
  } catch (cause) {
    return { ok: false, error: cause instanceof PackageError ? cause.error : miniAppError("PACKAGE_INSTALL_FAILED", String(cause)) };
  }
}

/** Numeric semver comparison for the minimum-runtime gate. */
export function compareVersions(left: string, right: string): number {
  const parse = (value: string): number[] => value.split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) > (b[index] ?? 0)) return 1;
    if ((a[index] ?? 0) < (b[index] ?? 0)) return -1;
  }
  return 0;
}

export function satisfiesRuntimeVersion(minimum: string, current: string): boolean {
  return compareVersions(current, minimum) >= 0;
}
