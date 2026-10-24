import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/// Mini App packages are immutable objects. Production uses the private
/// S3-compatible bucket already configured for media; a filesystem adapter is
/// available for local development or a VPS without object storage.
const s3Configured = () =>
  Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY,
  );

export const storageMode = () => (s3Configured() ? "s3" : "fs");

const bucket = () => process.env.S3_BUCKET ?? "qchat-private";
const s3 = () =>
  new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });

function root() {
  return resolve(process.env.MINIAPP_STORAGE_DIR ?? join(tmpdir(), "qchat-miniapps"));
}

function diskPath(key: string) {
  if (!/^miniapps\/mp_[a-z0-9]{12,24}\/[A-Za-z0-9._-]{1,80}$/.test(key))
    throw new Error("INVALID_STORAGE_KEY");
  const path = resolve(root(), key);
  if (!path.startsWith(root() + sep)) throw new Error("INVALID_STORAGE_KEY");
  return path;
}

export async function putBuild(key: string, bytes: Buffer) {
  if (s3Configured()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: bytes,
        ContentType: "application/zip",
        CacheControl: "private, max-age=0",
      }),
    );
    return;
  }
  const path = diskPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { mode: 0o600 });
}

export async function deleteBuild(key: string) {
  if (s3Configured()) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return;
  }
  await rm(diskPath(key), { force: true });
}

export async function readBuild(key: string) {
  if (s3Configured()) {
    const result = await s3().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error("BUILD_NOT_FOUND");
    return Buffer.from(bytes);
  }
  return readFile(diskPath(key));
}

export async function buildSize(key: string) {
  if (s3Configured()) return null;
  return (await stat(diskPath(key))).size;
}

function sign(key: string, expiresAt: number) {
  const secret = process.env.MINIAPP_SIGNING_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error("MINIAPP_SIGNING_SECRET is not configured");
  return createHmac("sha256", secret).update(`${key}|${expiresAt}`).digest("hex");
}

/// A short lived download location. S3 uses a presigned GET; the filesystem
/// adapter uses an HMAC signed URL served by `/api/miniapps/blob`, so internal
/// paths never reach a client.
export async function buildLocation(key: string, origin: string, seconds = 120) {
  if (s3Configured()) {
    const url = await getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: seconds },
    );
    return { url, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
  }
  const expiresAt = Math.floor(Date.now() / 1000) + seconds;
  const query = new URLSearchParams({
    key,
    exp: String(expiresAt),
    sig: sign(key, expiresAt),
  });
  return {
    url: `${origin.replace(/\/$/, "")}/api/miniapps/blob?${query.toString()}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function verifyBlobToken(key: string, exp: string, sig: string) {
  if (!/^\d{1,12}$/.test(exp)) return false;
  const expiresAt = Number(exp);
  if (expiresAt * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(key, expiresAt), "hex");
  const provided = Buffer.from(/^[a-f0-9]{64}$/.test(sig) ? sig : "", "hex");
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}
