import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import {
  qappManifestSchema,
  type QappManifest,
} from "../../../../packages/contracts/miniapps";
import { readZip, ZipError, type ZipEntry } from "./zip";

/// Hard limits for an uploaded `.japp`. A compiled Mini App stays far below
/// these bounds.
export const buildLimits = {
  maxArchiveBytes: 20 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
  maxEntries: 600,
};

export const qappLimits = {
  maxAppJsBytes: 4 * 1024 * 1024,
  maxManifestBytes: 64 * 1024,
  maxMetadataBytes: 64 * 1024,
};

const qappAssetExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".json",
  ".txt",
  ".mp3",
  ".wav",
  ".mp4",
]);

export class PackageError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type InspectedBuild = {
  manifest: QappManifest;
  format: "qapp";
  entry: string;
  sha256: string;
  size: number;
  permissions: string[];
  sdkVersion: string;
};

const qappMetadataSchema = z
  .object({
    formatVersion: z.literal(1),
    compilerVersion: z.string().min(1).max(40),
    sdkVersion: z.string().min(5).max(40),
    version: z.string().min(5).max(40),
    entry: z.literal("app.js"),
    builtAt: z.string().datetime(),
    appSha256: z.string().regex(/^[a-f0-9]{64}$/),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1).max(300),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            size: z.number().int().min(0),
          })
          .strict(),
      )
      .max(600),
  })
  .strict();

const qappPermissionsSchema = z
  .object({
    requestedPermissions: z.array(z.string()).max(32).default([]),
    /// Accepted for packages built before the host allowlist was removed; it
    /// is never read.
    networkDomains: z.array(z.string()).max(10).optional(),
  })
  .strict();

function parseJson(file: ZipEntry, code: string): unknown {
  try {
    return JSON.parse(file.bytes.toString("utf8"));
  } catch {
    throw new PackageError(code);
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestEntry(entries: ZipEntry[]): {
  file: ZipEntry;
  json: unknown;
} {
  const file = entries.find((entry) => entry.name === "manifest.json");
  if (!file) throw new PackageError("MANIFEST_MISSING");
  if (file.bytes.length > qappLimits.maxManifestBytes)
    throw new PackageError("MANIFEST_TOO_LARGE");
  return { file, json: parseJson(file, "MANIFEST_INVALID_JSON") };
}

function qappBuild(
  entries: ZipEntry[],
  json: unknown,
  expected: { version: string },
  archiveSha256: string,
  size: number,
): InspectedBuild {
  const parsed = qappManifestSchema.safeParse(json);
  if (!parsed.success) throw new PackageError("MANIFEST_INVALID");
  const manifest = parsed.data;
  if (manifest.version !== expected.version)
    throw new PackageError("VERSION_MISMATCH");

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const appEntry = byName.get("app.js");
  if (!appEntry) throw new PackageError("ENTRY_MISSING");
  if (appEntry.bytes.length === 0) throw new PackageError("ENTRY_EMPTY");
  if (appEntry.bytes.length > qappLimits.maxAppJsBytes)
    throw new PackageError("ENTRY_TOO_LARGE");
  if (appEntry.bytes.includes(Buffer.from("<html")))
    throw new PackageError("ENTRY_INVALID");
  const appSha256 = sha256(appEntry.bytes);
  if (manifest.appSha256 && manifest.appSha256 !== appSha256)
    throw new PackageError("APP_CHECKSUM_MISMATCH");

  const metadataEntry = byName.get("metadata.json");
  if (!metadataEntry) throw new PackageError("METADATA_MISSING");
  if (metadataEntry.bytes.length > qappLimits.maxMetadataBytes)
    throw new PackageError("METADATA_TOO_LARGE");
  const metadata = qappMetadataSchema.safeParse(
    parseJson(metadataEntry, "METADATA_INVALID"),
  );
  if (!metadata.success) throw new PackageError("METADATA_INVALID");
  if (
    metadata.data.version !== manifest.version ||
    metadata.data.appSha256 !== appSha256
  ) {
    throw new PackageError("METADATA_MISMATCH");
  }
  const declared = metadata.data.files.find((file) => file.path === "app.js");
  if (!declared || declared.sha256 !== appSha256 || declared.size !== appEntry.bytes.length)
    throw new PackageError("METADATA_MISMATCH");
  for (const file of metadata.data.files) {
    const actual = byName.get(file.path);
    if (!actual) throw new PackageError("METADATA_MISMATCH");
    if (actual.bytes.length !== file.size || sha256(actual.bytes) !== file.sha256)
      throw new PackageError("METADATA_MISMATCH");
  }

  const permissionsEntry = byName.get("permissions.json");
  if (!permissionsEntry) throw new PackageError("PERMISSIONS_MISSING");
  const permissions = qappPermissionsSchema.safeParse(
    parseJson(permissionsEntry, "PERMISSIONS_INVALID"),
  );
  if (!permissions.success) throw new PackageError("PERMISSIONS_INVALID");
  if (
    JSON.stringify(permissions.data.requestedPermissions) !==
    JSON.stringify(manifest.requestedPermissions)
  ) {
    throw new PackageError("PERMISSIONS_MISMATCH");
  }

  for (const entry of entries) {
    if (
      ["manifest.json", "app.js", "metadata.json", "permissions.json"].includes(
        entry.name,
      )
    ) {
      continue;
    }
    if (!entry.name.startsWith("assets/"))
      throw new PackageError("UNEXPECTED_FILE");
    const extension = path.extname(entry.name).toLowerCase();
    if (!qappAssetExtensions.has(extension))
      throw new PackageError("UNSUPPORTED_ASSET");
  }

  return {
    manifest,
    format: "qapp",
    entry: "app.js",
    sha256: archiveSha256,
    size,
    permissions: [...new Set(manifest.requestedPermissions)],
    sdkVersion: manifest.sdkVersion,
  };
}

/// Validates an uploaded `.japp` and returns the normalized manifest. Nothing is
/// written to storage until this function succeeds. Only native
/// `schemaVersion: 2` packages are accepted.
export function inspectBuild(
  bytes: Buffer,
  expected: { version: string },
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
  const { json } = manifestEntry(entries);
  const archiveSha256 = sha256(bytes);
  return qappBuild(entries, json, expected, archiveSha256, bytes.length);
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
