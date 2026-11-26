import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import {
  webappAssetExtensions,
  webappManifestSchema,
  webappMetadataSchema,
  type WebappManifest,
} from "../../../../packages/contracts/miniapps";
import { readZip, ZipError, type ZipEntry } from "./zip";

/// Hard limits for an uploaded `.japp`. A static web build stays far below
/// these bounds.
export const buildLimits = {
  maxArchiveBytes: 20 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
  maxEntries: 2000,
};

export const webappLimits = {
  maxEntryBytes: 2 * 1024 * 1024,
  maxManifestBytes: 64 * 1024,
  maxMetadataBytes: 256 * 1024,
};

const coreFiles = new Set([
  "manifest.json",
  "index.html",
  "metadata.json",
  "permissions.json",
]);

export class PackageError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type InspectedBuild = {
  manifest: WebappManifest;
  format: "webapp";
  entry: "index.html";
  sha256: string;
  size: number;
  permissions: string[];
  sdkVersion: string | null;
};

const permissionsSchema = z
  .object({
    requestedPermissions: z.array(z.string()).max(32).default([]),
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
  if (file.bytes.length > webappLimits.maxManifestBytes)
    throw new PackageError("MANIFEST_TOO_LARGE");
  return { file, json: parseJson(file, "MANIFEST_INVALID_JSON") };
}

function webappBuild(
  entries: ZipEntry[],
  json: unknown,
  expected: { version: string },
  archiveSha256: string,
  size: number,
): InspectedBuild {
  const parsed = webappManifestSchema.safeParse(json);
  if (!parsed.success) throw new PackageError("MANIFEST_INVALID");
  const manifest = parsed.data;
  if (manifest.version !== expected.version)
    throw new PackageError("VERSION_MISMATCH");

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const entryFile = byName.get("index.html");
  if (!entryFile) throw new PackageError("ENTRY_MISSING");
  if (entryFile.bytes.length === 0) throw new PackageError("ENTRY_EMPTY");
  if (entryFile.bytes.length > webappLimits.maxEntryBytes)
    throw new PackageError("ENTRY_TOO_LARGE");
  const entrySha256 = sha256(entryFile.bytes);

  const metadataEntry = byName.get("metadata.json");
  if (!metadataEntry) throw new PackageError("METADATA_MISSING");
  if (metadataEntry.bytes.length > webappLimits.maxMetadataBytes)
    throw new PackageError("METADATA_TOO_LARGE");
  const metadata = webappMetadataSchema.safeParse(
    parseJson(metadataEntry, "METADATA_INVALID"),
  );
  if (!metadata.success) throw new PackageError("METADATA_INVALID");
  if (
    metadata.data.version !== manifest.version ||
    metadata.data.entry !== manifest.entry ||
    metadata.data.entrySha256 !== entrySha256
  ) {
    throw new PackageError("METADATA_MISMATCH");
  }

  const declared = new Map(
    metadata.data.files.map((file) => [file.path, file] as const),
  );
  const declaredEntry = declared.get("index.html");
  if (
    !declaredEntry ||
    declaredEntry.sha256 !== entrySha256 ||
    declaredEntry.size !== entryFile.bytes.length
  ) {
    throw new PackageError("METADATA_MISMATCH");
  }
  for (const file of metadata.data.files) {
    const actual = byName.get(file.path);
    if (!actual) throw new PackageError("METADATA_MISMATCH");
    if (actual.bytes.length !== file.size || sha256(actual.bytes) !== file.sha256)
      throw new PackageError("METADATA_MISMATCH");
  }

  const permissionsEntry = byName.get("permissions.json");
  if (!permissionsEntry) throw new PackageError("PERMISSIONS_MISSING");
  const permissions = permissionsSchema.safeParse(
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
    if (coreFiles.has(entry.name)) continue;
    if (!entry.name.startsWith("assets/"))
      throw new PackageError("UNEXPECTED_FILE");
    const extension = path.extname(entry.name).toLowerCase();
    if (!webappAssetExtensions.has(extension))
      throw new PackageError("UNSUPPORTED_ASSET");
  }
  for (const name of declared.keys()) {
    if (coreFiles.has(name)) continue;
    if (!name.startsWith("assets/"))
      throw new PackageError("UNEXPECTED_FILE");
  }

  return {
    manifest,
    format: "webapp",
    entry: "index.html",
    sha256: archiveSha256,
    size,
    permissions: [...new Set(manifest.requestedPermissions)],
    sdkVersion: null,
  };
}

/// Validates an uploaded `.japp` and returns the normalized manifest. Nothing is
/// written to storage until this function succeeds. Only static web packages
/// (`schemaVersion: 3`, `format: "webapp"`) are accepted.
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
  return webappBuild(entries, json, expected, archiveSha256, bytes.length);
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
