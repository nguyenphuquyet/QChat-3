/**
 * Reference package store and per-app storage (specification section 10).
 *
 * The store verifies a package before writing, extracts it into a staging
 * directory, moves that directory into place with one rename, and only then
 * updates the small `state.json` that names the current and previous versions.
 * A failed install leaves the previous version untouched. Android and iOS
 * implement the same layout and rules; the Node store is what the tests and the
 * desktop simulator use.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { miniAppError, type MiniAppError, type MiniAppManifest } from "@qchat/miniapp-contracts";
import {
  MANIFEST_FILE,
  PackageError,
  compareVersions,
  sha256Hex,
  verifyPackage,
  type PackageLimits,
  type PackageResult,
} from "./package.js";

export interface PackageStoreOptions {
  /** Public keys by key id; the private key never reaches the app. */
  publicKeys: Readonly<Record<string, string | import("node:crypto").KeyObject>>;
  /** The runtime version used for `minRuntimeVersion`. */
  runtimeVersion: string;
  /** `appId@version` entries that may not be installed. */
  revoked?: readonly string[];
  /** A downgrade is refused unless this is explicitly true. */
  allowDowngrade?: boolean;
  limits?: Partial<PackageLimits>;
}

export interface InstalledPackage {
  manifest: MiniAppManifest;
  directory: string;
}

interface AppState {
  current: string | null;
  previous: string | null;
}

const APP_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,7}$/;
const STATE_FILE = "state.json";

function fail(code: MiniAppError["code"], message?: string): PackageError {
  return new PackageError(miniAppError(code, message));
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw fail("PACKAGE_INSTALL_FAILED", `The file is corrupt: ${path}.`);
  }
}

function writeJsonAtomic(path: string, value: unknown): void {
  const temporary = `${path}.tmp-${randomBytes(6).toString("hex")}`;
  writeFileSync(temporary, JSON.stringify(value), "utf8");
  renameSync(temporary, path);
}

function checkAppId(appId: string): void {
  if (typeof appId !== "string" || !APP_ID.test(appId) || appId.length > 128) {
    throw fail("MANIFEST_INVALID", "The app id is invalid.");
  }
}

function emptyState(): AppState {
  return { current: null, previous: null };
}

export class PackageStore {
  private readonly options: PackageStoreOptions;

  constructor(readonly root: string, options: PackageStoreOptions) {
    this.options = options;
  }

  private appDir(appId: string): string {
    checkAppId(appId);
    return join(this.root, "apps", appId);
  }

  private versionsDir(appId: string): string {
    return join(this.appDir(appId), "versions");
  }

  private statePath(appId: string): string {
    return join(this.appDir(appId), STATE_FILE);
  }

  readState(appId: string): AppState {
    const state = readJsonFile<AppState>(this.statePath(appId));
    if (!state) return emptyState();
    if (typeof state.current !== "string" && state.current !== null) throw fail("PACKAGE_INSTALL_FAILED");
    if (typeof state.previous !== "string" && state.previous !== null) throw fail("PACKAGE_INSTALL_FAILED");
    return { current: state.current, previous: state.previous };
  }

  private writeState(appId: string, state: AppState): void {
    mkdirSync(this.appDir(appId), { recursive: true });
    writeJsonAtomic(this.statePath(appId), state);
  }

  private isRevoked(appId: string, version: string): boolean {
    return (this.options.revoked ?? []).includes(`${appId}@${version}`);
  }

  /** Verify, extract and atomically make this version current. */
  install(bytes: Uint8Array): PackageResult<InstalledPackage> {
    try {
      const verified = verifyPackage(bytes, {
        publicKeys: this.options.publicKeys,
        runtimeVersion: this.options.runtimeVersion,
        limits: this.options.limits,
      });
      if (!verified.ok) return verified;
      const { manifest, files } = verified.value;
      const appId = manifest.appId;
      if (this.isRevoked(appId, manifest.version)) throw fail("PACKAGE_REVOKED");

      const state = this.readState(appId);
      if (state.current !== null && compareVersions(manifest.version, state.current) < 0 && !this.options.allowDowngrade) {
        throw fail("PACKAGE_DOWNGRADE_BLOCKED");
      }

      const versions = this.versionsDir(appId);
      mkdirSync(versions, { recursive: true });
      const staging = join(this.appDir(appId), `.staging-${randomBytes(8).toString("hex")}`);
      mkdirSync(staging, { recursive: true });
      try {
        for (const [path, content] of files) {
          const target = join(staging, path);
          mkdirSync(join(target, ".."), { recursive: true });
          writeFileSync(target, content);
        }
        writeFileSync(join(staging, MANIFEST_FILE), JSON.stringify(manifest), "utf8");

        const target = join(versions, manifest.version);
        let trash: string | null = null;
        try {
          if (existsSync(target)) {
            trash = join(this.appDir(appId), `.trash-${randomBytes(8).toString("hex")}`);
            renameSync(target, trash);
            renameSync(staging, target);
          } else {
            renameSync(staging, target);
          }
        } catch (cause) {
          // Put the previous version back before reporting the failure.
          if (trash !== null && !existsSync(target) && existsSync(trash)) renameSync(trash, target);
          throw cause;
        }
        const next: AppState = {
          current: manifest.version,
          previous: state.current === manifest.version ? state.previous : state.current,
        };
        try {
          this.writeState(appId, next);
        } catch (cause) {
          // The state file still names the old version, so put the old content
          // back instead of leaving a version the state does not know about.
          rmSync(target, { recursive: true, force: true });
          if (trash !== null && existsSync(trash)) renameSync(trash, target);
          throw cause;
        }
        if (trash !== null) rmSync(trash, { recursive: true, force: true });
        this.prune(appId, next);
        return { ok: true, value: { manifest, directory: target } };
      } catch (cause) {
        rmSync(staging, { recursive: true, force: true });
        throw cause;
      }
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof PackageError ? cause.error : miniAppError("PACKAGE_INSTALL_FAILED", String(cause)),
      };
    }
  }

  /** The verified version that is currently installed, or `null`. */
  current(appId: string): InstalledPackage | null {
    const state = this.readState(appId);
    if (state.current === null) return null;
    const directory = join(this.versionsDir(appId), state.current);
    const manifest = readJsonFile<MiniAppManifest>(join(directory, MANIFEST_FILE));
    if (!manifest || manifest.version !== state.current) {
      throw fail("PACKAGE_INSTALL_FAILED", "The current version is missing or corrupt.");
    }
    return { manifest, directory };
  }

  /** Switch back to the previous verified version. No extraction is repeated. */
  rollback(appId: string): PackageResult<InstalledPackage> {
    try {
      const state = this.readState(appId);
      if (state.previous === null) throw fail("PACKAGE_INSTALL_FAILED", "There is no previous version.");
      const directory = join(this.versionsDir(appId), state.previous);
      const manifest = readJsonFile<MiniAppManifest>(join(directory, MANIFEST_FILE));
      if (!manifest || manifest.version !== state.previous) {
        throw fail("PACKAGE_INSTALL_FAILED", "The previous version is missing or corrupt.");
      }
      const next: AppState = { current: state.previous, previous: state.current };
      this.writeState(appId, next);
      return { ok: true, value: { manifest, directory } };
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof PackageError ? cause.error : miniAppError("PACKAGE_INSTALL_FAILED", String(cause)),
      };
    }
  }

  versions(appId: string): string[] {
    const directory = this.versionsDir(appId);
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
      .filter((name) => {
        try {
          return statSync(join(directory, name)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort((left, right) => compareVersions(right, left));
  }

  uninstall(appId: string): void {
    rmSync(this.appDir(appId), { recursive: true, force: true });
  }

  private prune(appId: string, state: AppState): void {
    const keep = new Set([state.current, state.previous].filter((value): value is string => value !== null));
    for (const version of this.versions(appId)) {
      if (!keep.has(version)) {
        rmSync(join(this.versionsDir(appId), version), { recursive: true, force: true });
      }
    }
  }
}

/**
 * Per-app storage under one private directory. A key is hashed for the file
 * name, so a key can never choose a path; the original key is stored inside so
 * `entries()` can report it. Reads never cross an app directory.
 */
export class FileStorageAdapter {
  private readonly directory: string;
  private readonly quota: number;

  constructor(root: string, appId: string, quotaBytes = 10 * 1024 * 1024) {
    checkAppId(appId);
    if (!Number.isSafeInteger(quotaBytes) || quotaBytes < 0) throw new RangeError("invalid storage quota");
    this.directory = join(root, "storage", appId);
    this.quota = quotaBytes;
  }

  private file(key: string): string {
    return join(this.directory, `${sha256Hex(Buffer.from(key, "utf8"))}.json`);
  }

  private checkKey(key: string): void {
    if (typeof key !== "string" || key.length === 0 || key.length > 256 || /[\u0000-\u001f]/.test(key)) {
      throw new PackageError(miniAppError("STORAGE_KEY_INVALID"));
    }
  }

  read(key: string): string | null {
    this.checkKey(key);
    const path = this.file(key);
    if (!existsSync(path)) return null;
    try {
      const record = JSON.parse(readFileSync(path, "utf8")) as { key?: unknown; value?: unknown };
      if (record.key !== key || typeof record.value !== "string") throw new Error("record");
      return record.value;
    } catch {
      throw new PackageError(miniAppError("STORAGE_CORRUPT"));
    }
  }

  write(key: string, value: string): void {
    this.checkKey(key);
    if (typeof value !== "string") throw new PackageError(miniAppError("API_INVALID_ARGUMENT"));
    mkdirSync(this.directory, { recursive: true });
    const path = this.file(key);
    const previous = existsSync(path) ? statSync(path).size : 0;
    const used = this.entriesRaw().reduce((total, entry) => total + entry.bytes, 0) - previous;
    const bytes = Buffer.byteLength(JSON.stringify({ key, value }), "utf8");
    if (used + bytes > this.quota) throw new PackageError(miniAppError("STORAGE_QUOTA_EXCEEDED"));
    writeJsonAtomic(path, { key, value });
  }

  remove(key: string): void {
    this.checkKey(key);
    rmSync(this.file(key), { force: true });
  }

  clear(): void {
    rmSync(this.directory, { recursive: true, force: true });
  }

  entries(): ReadonlyArray<readonly [string, string]> {
    return this.entriesRaw().map((entry) => [entry.key, entry.value] as const);
  }

  private entriesRaw(): Array<{ key: string; value: string; bytes: number }> {
    if (!existsSync(this.directory)) return [];
    const result: Array<{ key: string; value: string; bytes: number }> = [];
    for (const name of readdirSync(this.directory)) {
      if (!name.endsWith(".json")) continue;
      const path = join(this.directory, name);
      try {
        const record = JSON.parse(readFileSync(path, "utf8")) as { key?: unknown; value?: unknown };
        if (typeof record.key !== "string" || typeof record.value !== "string") continue;
        result.push({ key: record.key, value: record.value, bytes: statSync(path).size });
      } catch {
        continue;
      }
    }
    return result;
  }
}
