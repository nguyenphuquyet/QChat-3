import { createHmac, timingSafeEqual } from "node:crypto";
import { buildLimits } from "./miniapp-package";
import { readZip } from "./zip";

/// Reviewer inspection: the stored `.japp` is opened read-only and one raw file
/// is returned. Nothing is extracted and no code is executed server-side; the
/// real rendering happens only in the Flutter QuickJS host.
const contentTypes: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
};

const previewTokenSeconds = 15 * 60;

function previewSecret() {
  const secret = process.env.MINIAPP_SIGNING_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error("MINIAPP_SIGNING_SECRET is not configured");
  return secret;
}

function previewSignature(versionId: string, expiresAt: number) {
  return createHmac("sha256", previewSecret())
    .update(`preview|${versionId}|${expiresAt}`)
    .digest("hex");
}

/// Preview files live in a sandboxed frame with an opaque origin, so the
/// browser does not attach the reviewer's session cookie to asset requests. A
/// short-lived token in the URL path authenticates those requests instead; it
/// is scoped to one build and expires quickly.
export function createPreviewToken(versionId: string, seconds = previewTokenSeconds) {
  const expiresAt = Math.floor(Date.now() / 1000) + seconds;
  return {
    token: `${expiresAt}-${previewSignature(versionId, expiresAt)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function verifyPreviewToken(versionId: string, token: string) {
  const match = /^(\d{1,12})-([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt * 1000 < Date.now()) return false;
  const expected = Buffer.from(previewSignature(versionId, expiresAt), "hex");
  const provided = Buffer.from(match[2], "hex");
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

export function previewContentType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return contentTypes[extension] ?? "application/octet-stream";
}

/// Returns one file exactly as stored in the package. Reviewers can inspect
/// `manifest.json`, `permissions.json`, `metadata.json`, `app.js` or any
/// declared asset.
export function readRawPreviewFile(archive: Buffer, name: string) {
  const entry = readZip(archive, buildLimits).find((file) => file.name === name);
  if (!entry) return null;
  return {
    name: entry.name,
    type: previewContentType(entry.name),
    bytes: entry.bytes,
  };
}
