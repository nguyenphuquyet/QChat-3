import { deflateRawSync, inflateRawSync } from "node:zlib";

export interface ZipEntryInput {
  name: string;
  data: Buffer;
}

export interface ZipEntry {
  name: string;
  bytes: Buffer;
  compressedSize: number;
  size: number;
  method: number;
  crc: number;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipWriteOptions {
  /** Fixed timestamp makes package bytes reproducible in tests. */
  date?: Date;
  compress?: boolean;
}

export function writeZip(
  entries: ZipEntryInput[],
  options: ZipWriteOptions = {},
): Buffer {
  if (entries.length > 600) throw new Error("ZIP_TOO_MANY_ENTRIES");
  const date = options.date ?? new Date();
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const seen = new Set<string>();
  for (const entry of entries) {
    const name = entry.name.replaceAll("\\", "/");
    if (!isSafeName(name)) throw new Error("ZIP_INVALID_NAME");
    if (seen.has(name.toLowerCase())) throw new Error("ZIP_DUPLICATE_FILE");
    seen.add(name.toLowerCase());
    const nameBytes = Buffer.from(name, "utf8");
    const raw = entry.data;
    const method = options.compress === false ? 0 : 8;
    const body = method === 8 ? deflateRawSync(raw, { level: 9 }) : raw;
    if (raw.length > 20 * 1024 * 1024) throw new Error("ZIP_ENTRY_TOO_LARGE");
    const checksum = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, body);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, directory, end]);
}

export interface ZipReadLimits {
  maxArchiveBytes: number;
  maxTotalBytes: number;
  maxEntryBytes: number;
  maxEntries: number;
}

export const defaultZipLimits: ZipReadLimits = {
  maxArchiveBytes: 20 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
  maxEntries: 600,
};

export function isSafeName(raw: string): boolean {
  const name = raw.replaceAll("\\", "/");
  if (
    !name ||
    name.startsWith("/") ||
    name.includes("\u0000") ||
    name.includes(":") ||
    /^[a-z]+:/i.test(name)
  ) {
    return false;
  }
  const parts = name.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function readZip(
  bytes: Buffer,
  limits: ZipReadLimits = defaultZipLimits,
): ZipEntry[] {
  if (bytes.length === 0) throw new Error("ZIP_EMPTY");
  if (bytes.length > limits.maxArchiveBytes) throw new Error("ZIP_TOO_LARGE");
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP_INVALID");
  const count = bytes.readUInt16LE(eocd + 10);
  const directorySize = bytes.readUInt32LE(eocd + 12);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  if (count > limits.maxEntries) throw new Error("ZIP_TOO_MANY_ENTRIES");
  if (directoryOffset + directorySize > bytes.length) throw new Error("ZIP_INVALID");
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let pointer = directoryOffset;
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (pointer + 46 > bytes.length) throw new Error("ZIP_INVALID");
    if (bytes.readUInt32LE(pointer) !== 0x02014b50) throw new Error("ZIP_INVALID");
    const flags = bytes.readUInt16LE(pointer + 8);
    const method = bytes.readUInt16LE(pointer + 10);
    const checksum = bytes.readUInt32LE(pointer + 16);
    const compressedSize = bytes.readUInt32LE(pointer + 20);
    const size = bytes.readUInt32LE(pointer + 24);
    const nameLength = bytes.readUInt16LE(pointer + 28);
    const extraLength = bytes.readUInt16LE(pointer + 30);
    const commentLength = bytes.readUInt16LE(pointer + 32);
    const localOffset = bytes.readUInt32LE(pointer + 42);
    const name = bytes
      .subarray(pointer + 46, pointer + 46 + nameLength)
      .toString("utf8");
    if (flags & 1) throw new Error("ZIP_ENCRYPTED");
    if (!isSafeName(name)) throw new Error("ZIP_INVALID_NAME");
    if (names.has(name.toLowerCase())) throw new Error("ZIP_DUPLICATE_FILE");
    names.add(name.toLowerCase());
    if (size > limits.maxEntryBytes) throw new Error("ZIP_ENTRY_TOO_LARGE");
    total += size;
    if (total > limits.maxTotalBytes) throw new Error("ZIP_TOO_LARGE");
    if (localOffset + 30 > bytes.length) throw new Error("ZIP_INVALID");
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP_INVALID");
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > bytes.length) throw new Error("ZIP_INVALID");
    const body = bytes.subarray(dataOffset, dataOffset + compressedSize);
    let content: Buffer;
    if (method === 0) content = Buffer.from(body);
    else if (method === 8) {
      try {
        content = inflateRawSync(body, { maxOutputLength: limits.maxEntryBytes });
      } catch {
        throw new Error("ZIP_INVALID");
      }
    } else {
      throw new Error("ZIP_METHOD");
    }
    if (content.length !== size) throw new Error("ZIP_SIZE");
    if (crc32(content) !== checksum) throw new Error("ZIP_CHECKSUM");
    entries.push({ name, bytes: content, compressedSize, size, method, crc: checksum });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
