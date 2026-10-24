import { inflateRawSync } from "node:zlib";

/// Minimal, dependency-free ZIP reader for Mini App packages. It only accepts
/// the two storage methods a Vite build produces (stored/deflate), rejects
/// encrypted entries, symlinks and any path that could escape the extraction
/// directory, and enforces size limits while inflating instead of afterwards.
export type ZipLimits = {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
  maxArchiveBytes: number;
};

export type ZipEntry = { name: string; bytes: Buffer };

export class ZipError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const SIG_EOCD = 0x06054b50;
const SIG_CD = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/// Extensions a Vite/React build can legitimately contain. Everything else is
/// rejected so a package cannot ship executables or server-side scripts.
const allowedExtensions = new Set([
  "html",
  "htm",
  "js",
  "mjs",
  "css",
  "json",
  "map",
  "txt",
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
  "wasm",
]);

function findEocd(buffer: Buffer) {
  const stop = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= stop; offset--) {
    if (buffer.readUInt32LE(offset) !== SIG_EOCD) continue;
    const comment = buffer.readUInt16LE(offset + 20);
    if (offset + 22 + comment === buffer.length) return offset;
  }
  throw new ZipError("ZIP_INVALID");
}

function safeName(raw: string, directory: boolean) {
  if (!raw || raw.length > 240) throw new ZipError("ZIP_INVALID_NAME");
  if (/[\u0000-\u001f\\]/.test(raw)) throw new ZipError("ZIP_INVALID_NAME");
  if (raw.startsWith("/") || /^[a-z]:/i.test(raw)) throw new ZipError("ZIP_INVALID_NAME");
  const name = directory ? raw.replace(/\/$/, "") : raw;
  if (!name) throw new ZipError("ZIP_INVALID_NAME");
  for (const part of name.split("/")) {
    if (!part || part === "." || part === "..") throw new ZipError("ZIP_INVALID_NAME");
  }
  return name;
}

function checkExtension(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.has(extension)) throw new ZipError("ZIP_FILE_TYPE");
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function readZip(buffer: Buffer, limits: ZipLimits): ZipEntry[] {
  if (buffer.length > limits.maxArchiveBytes) throw new ZipError("ZIP_TOO_LARGE");
  const eocd = findEocd(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (count === 0) throw new ZipError("ZIP_EMPTY");
  if (count > limits.maxEntries) throw new ZipError("ZIP_TOO_MANY_FILES");
  if (count === 0xffff || directoryOffset === 0xffffffff)
    throw new ZipError("ZIP64_UNSUPPORTED");
  if (directoryOffset + directorySize > eocd) throw new ZipError("ZIP_INVALID");

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  let offset = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== SIG_CD)
      throw new ZipError("ZIP_INVALID");
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
    if (offset + 46 + nameLength + extraLength + commentLength > buffer.length)
      throw new ZipError("ZIP_INVALID");
    const rawName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    const directory = rawName.endsWith("/");
    const name = safeName(rawName, directory);
    offset += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) throw new ZipError("ZIP_ENCRYPTED");
    // Unix file mode lives in the high 16 bits of the external attributes.
    const mode = (externalAttributes >>> 16) & 0xffff;
    if (mode && (mode & 0xf000) === 0xa000) throw new ZipError("ZIP_SYMLINK");
    if (directory) continue;
    if (method !== 0 && method !== 8) throw new ZipError("ZIP_COMPRESSION");
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff)
      throw new ZipError("ZIP64_UNSUPPORTED");
    if (uncompressedSize > limits.maxEntryBytes) throw new ZipError("ZIP_ENTRY_TOO_LARGE");
    const key = name.toLowerCase();
    if (seen.has(key)) throw new ZipError("ZIP_DUPLICATE_FILE");
    seen.add(key);
    checkExtension(name);

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== SIG_LOCAL)
      throw new ZipError("ZIP_INVALID");
    const localName = buffer.readUInt16LE(localOffset + 26);
    const localExtra = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localName + localExtra;
    if (dataStart + compressedSize > buffer.length) throw new ZipError("ZIP_INVALID");
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    let bytes: Buffer;
    if (method === 0) {
      bytes = Buffer.from(raw);
    } else {
      // Cap the output while inflating: a small archive cannot expand into
      // gigabytes even before the total-size check below runs.
      const remaining = limits.maxTotalBytes - total;
      const cap = Math.min(limits.maxEntryBytes, remaining) + 1;
      try {
        bytes = inflateRawSync(raw, { maxOutputLength: cap });
      } catch {
        throw new ZipError("ZIP_INVALID");
      }
    }
    if (bytes.length !== uncompressedSize) throw new ZipError("ZIP_INVALID");
    if (crc32(bytes) !== checksum) throw new ZipError("ZIP_CHECKSUM");
    total += bytes.length;
    if (total > limits.maxTotalBytes) throw new ZipError("ZIP_TOO_LARGE");
    entries.push({ name, bytes });
  }
  return entries;
}
