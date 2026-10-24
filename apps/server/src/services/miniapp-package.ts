import { createHash } from "node:crypto";
import { z } from "zod";
import {
  miniappManifestSchema,
  type MiniappManifest,
} from "../../../../packages/contracts/miniapps";
import { readZip, ZipError, type ZipEntry } from "./zip";

/// Hard limits for an uploaded Mini App. They are intentionally small: a Vite
/// build for a Mini App should stay far below these numbers.
export const buildLimits = {
  maxArchiveBytes: 20 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
  maxEntries: 600,
};

export class PackageError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type InspectedBuild = {
  manifest: MiniappManifest;
  entry: string;
  sha256: string;
  size: number;
  permissions: string[];
};

function manifestEntry(entries: ZipEntry[]) {
  const file = entries.find((entry) => entry.name === "qchat.manifest.json");
  if (!file) throw new PackageError("MANIFEST_MISSING");
  if (file.bytes.length > 64 * 1024) throw new PackageError("MANIFEST_TOO_LARGE");
  let json: unknown;
  try {
    json = JSON.parse(file.bytes.toString("utf8"));
  } catch {
    throw new PackageError("MANIFEST_INVALID_JSON");
  }
  const parsed = miniappManifestSchema.safeParse(json);
  if (!parsed.success) throw new PackageError("MANIFEST_INVALID");
  return parsed.data;
}

/// Validates an uploaded ZIP and returns the normalized manifest. Nothing is
/// written to storage until this function succeeds.
export function inspectBuild(
  bytes: Buffer,
  expected: { appId: string; version: string },
): InspectedBuild {
  if (bytes.length === 0) throw new PackageError("BUILD_EMPTY");
  if (bytes.length > buildLimits.maxArchiveBytes)
    throw new PackageError("BUILD_TOO_LARGE");
  let entries: ZipEntry[];
  try {
    entries = readZip(bytes, buildLimits);
  } catch (error) {
    if (error instanceof ZipError) throw new PackageError(error.code);
    throw error;
  }
  const manifest = manifestEntry(entries);
  if (manifest.appId !== expected.appId) throw new PackageError("APP_ID_MISMATCH");
  if (manifest.version !== expected.version)
    throw new PackageError("VERSION_MISMATCH");
  const entry = entries.find((file) => file.name === manifest.entry);
  if (!entry) throw new PackageError("ENTRY_MISSING");
  if (!/\.html?$/i.test(manifest.entry)) throw new PackageError("ENTRY_INVALID");
  if (entries.filter((file) => file.name === "index.html").length > 1)
    throw new PackageError("DUPLICATE_ENTRY");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    // The server owns the integrity fields; a client supplied buildHash is
    // never trusted and is replaced by the archive hash.
    manifest: { ...manifest, buildHash: sha256 },
    entry: manifest.entry,
    sha256,
    size: bytes.length,
    permissions: [...new Set(manifest.requestedPermissions)],
  };
}

export const createBuildSchema = z
  .object({
    version: z
      .string()
      .trim()
      .regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,20})?$/),
    channel: z.enum(["DEVELOPMENT", "PREVIEW", "PRODUCTION"]).default("DEVELOPMENT"),
  })
  .strict();
