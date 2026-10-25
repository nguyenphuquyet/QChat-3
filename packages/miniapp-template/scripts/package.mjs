// Packages `dist/` and `qchat.manifest.json` into an immutable ZIP without any
// extra dependency. The QChat server validates the same layout and computes the
// authoritative SHA-256, so this script only prints a local checksum for CI.
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const dist = join(root, "dist");
const release = join(root, "release");
const manifestPath = join(root, "qchat.manifest.json");

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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(absolute, name)));
    else if (entry.isFile()) files.push({ absolute, name });
  }
  return files;
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const data = entry.data;
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const method = compressed.length < data.length ? 8 : 0;
    const body = method === 8 ? compressed : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
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

const manifestBytes = await readFile(manifestPath);
let manifest;
try {
  manifest = JSON.parse(manifestBytes.toString("utf8"));
} catch {
  throw new Error("qchat.manifest.json is not valid JSON");
}
if (!/^mp_[a-z0-9]{12,24}$/.test(manifest.appId ?? "")) {
  throw new Error("Replace appId in qchat.manifest.json with the id from Developer Center");
}
if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,20})?$/.test(manifest.version ?? "")) {
  throw new Error("manifest.version must be semver, e.g. 1.0.0");
}
if (manifest.entry !== "index.html") {
  throw new Error("This starter expects entry to be index.html");
}
const files = await walk(dist);
const index = files.find((file) => file.name === "index.html");
if (!index) throw new Error("Run `vite build` first: dist/index.html is missing");
files.sort((a, b) => a.name.localeCompare(b.name));
files.push({ name: "qchat.manifest.json", data: manifestBytes });
const entries = [];
for (const file of files) {
  const name = file.name.split(sep).join("/");
  if (name.startsWith("/") || name.split("/").some((part) => part === ".." || part === ""))
    throw new Error(`Unsafe path in package: ${name}`);
  entries.push({ name, data: file.data ?? (await readFile(file.absolute)) });
}
const archive = zip(entries);
const checksum = createHash("sha256").update(archive).digest("hex");
await mkdir(release, { recursive: true });
const output = join(release, `${manifest.appId}-${manifest.version}.zip`);
await rm(output, { force: true });
await writeFile(output, archive);
console.log(`Packaged ${relative(root, output)}`);
console.log(`SHA-256 ${checksum}`);
console.log(`Files ${entries.length}, size ${archive.length} bytes`);
