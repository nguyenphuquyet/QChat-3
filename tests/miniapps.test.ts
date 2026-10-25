import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  miniappManifestSchema,
  miniappApiAllowlist,
  miniappPermissionIds,
} from "../packages/contracts/miniapps";
import {
  buildLimits,
  inspectBuild,
  PackageError,
} from "../apps/server/src/services/miniapp-package";
import {
  crc32,
  readZip,
  ZipError,
  type ZipLimits,
} from "../apps/server/src/services/zip";
import {
  buildLocation,
  verifyBlobToken,
} from "../apps/server/src/services/miniapp-storage";
import {
  injectPreviewBridge,
  previewContentType,
  readPreviewFile,
  type PreviewMeta,
} from "../apps/server/src/services/miniapp-preview";

type Entry = {
  name: string;
  data: Buffer | string;
  method?: 0 | 8;
  flags?: number;
  crc?: number;
  declaredSize?: number;
  externalAttributes?: number;
  localOffset?: number;
  nameOverride?: string;
};

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

// Independent CRC implementation so the ZIP reader is not tested against
// itself.
function referenceCrc(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes)
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries: Entry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data);
    const method = entry.method ?? 0;
    const body = method === 8 ? deflateRawSync(data) : data;
    const name = Buffer.from(entry.nameOverride ?? entry.name, "utf8");
    const checksum = entry.crc ?? referenceCrc(data);
    const declared = entry.declaredSize ?? data.length;
    const flags = entry.flags ?? 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(declared, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(declared, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(entry.externalAttributes ?? 0, 38);
    central.writeUInt32LE(entry.localOffset ?? offset, 42);
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

const manifest = {
  schemaVersion: 1,
  appId: "mp_0123456789abcdef",
  name: "Demo",
  description: "A test app",
  version: "1.2.3",
  entry: "index.html",
  minRuntimeVersion: "1.0.0",
  requestedPermissions: ["toast", "storage"],
};

function appZip(overrides: Partial<typeof manifest> = {}, files?: Entry[]) {
  return makeZip(
    files ?? [
      {
        name: "qchat.manifest.json",
        data: JSON.stringify({ ...manifest, ...overrides }),
      },
      { name: "index.html", data: "<!doctype html><h1>hi</h1>" },
      { name: "assets/app.js", data: "console.log('qchat')", method: 8 },
    ],
  );
}

const limits: ZipLimits = { ...buildLimits };

test("ZIP reader accepts a stored and deflated build", () => {
  const bytes = appZip();
  const entries = readZip(bytes, limits);
  assert.equal(entries.length, 3);
  assert.equal(
    entries.find((entry) => entry.name === "assets/app.js")?.bytes.toString(),
    "console.log('qchat')",
  );
  assert.equal(crc32(Buffer.from("hello")), referenceCrc(Buffer.from("hello")));
});

test("ZIP reader rejects path traversal and absolute paths", () => {
  for (const name of [
    "../evil.js",
    "assets/../../evil.js",
    "/etc/passwd",
    "a\\b.js",
    "C:/windows/system32.js",
    "./index.html",
  ]) {
    assert.throws(
      () => readZip(makeZip([{ name, data: "x" }]), limits),
      (error: unknown) =>
        error instanceof ZipError && error.code === "ZIP_INVALID_NAME",
      name,
    );
  }
});

test("ZIP reader rejects duplicate names case-insensitively", () => {
  const bytes = makeZip([
    { name: "index.html", data: "a" },
    { name: "INDEX.html", data: "b" },
  ]);
  assert.throws(
    () => readZip(bytes, limits),
    (error: unknown) =>
      error instanceof ZipError && error.code === "ZIP_DUPLICATE_FILE",
  );
});

test("ZIP reader rejects encrypted entries and symlinks", () => {
  assert.throws(
    () => readZip(makeZip([{ name: "a.js", data: "x", flags: 1 }]), limits),
    (error: unknown) =>
      error instanceof ZipError && error.code === "ZIP_ENCRYPTED",
  );
  assert.throws(
    () =>
      readZip(
        makeZip([
          { name: "link.js", data: "x", externalAttributes: 0xa1ff0000 },
        ]),
        limits,
      ),
    (error: unknown) => error instanceof ZipError && error.code === "ZIP_SYMLINK",
  );
});

test("ZIP reader rejects executable file types", () => {
  assert.throws(
    () => readZip(makeZip([{ name: "payload.exe", data: "MZ" }]), limits),
    (error: unknown) =>
      error instanceof ZipError && error.code === "ZIP_FILE_TYPE",
  );
});

test("ZIP reader rejects a corrupted archive", () => {
  const bytes = makeZip([
    { name: "qchat.manifest.json", data: JSON.stringify(manifest) },
    { name: "index.html", data: "hello world" },
  ]);
  const corrupted = Buffer.from(bytes);
  const index = corrupted.indexOf(Buffer.from("hello world"));
  corrupted[index] ^= 0xff;
  assert.throws(
    () => readZip(corrupted, limits),
    (error: unknown) =>
      error instanceof ZipError && error.code === "ZIP_CHECKSUM",
  );
});

test("ZIP reader enforces archive, entry and total limits", () => {
  assert.throws(
    () =>
      readZip(makeZip([{ name: "a.js", data: "x" }]), {
        ...limits,
        maxArchiveBytes: 10,
      }),
    (error: unknown) =>
      error instanceof ZipError && error.code === "ZIP_TOO_LARGE",
  );
  assert.throws(
    () =>
      readZip(makeZip([{ name: "a.js", data: "x".repeat(500) }]), {
        ...limits,
        maxEntryBytes: 100,
      }),
    (error: unknown) =>
      error instanceof ZipError && error.code === "ZIP_ENTRY_TOO_LARGE",
  );
  assert.throws(
    () =>
      readZip(
        makeZip([
          { name: "a.js", data: "x".repeat(400) },
          { name: "b.js", data: "y".repeat(400) },
        ]),
        { ...limits, maxTotalBytes: 500, maxEntryBytes: 500 },
      ),
    (error: unknown) =>
      error instanceof ZipError && error.code === "ZIP_TOO_LARGE",
  );
});

test("ZIP reader stops inflating before an archive bomb can exhaust memory", () => {
  const bomb = Buffer.alloc(4 * 1024 * 1024, 0);
  const bytes = makeZip([
    { name: "bomb.js", data: bomb, method: 8, declaredSize: 10 },
  ]);
  assert.ok(bytes.length < 100 * 1024);
  assert.throws(
    () =>
      readZip(bytes, {
        ...limits,
        maxEntryBytes: 1024 * 1024,
        maxTotalBytes: 1024 * 1024,
      }),
    (error: unknown) => error instanceof ZipError,
  );
});

test("build inspection normalizes the manifest and owns the hash", () => {
  const bytes = appZip();
  const inspected = inspectBuild(bytes, {
    appId: manifest.appId,
    version: manifest.version,
  });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert.equal(inspected.sha256, sha256);
  assert.equal(inspected.manifest.buildHash, sha256);
  assert.equal(inspected.size, bytes.length);
  assert.deepEqual(inspected.permissions, ["toast", "storage"]);
  assert.equal(inspected.entry, "index.html");
});

test("build inspection rejects a mismatched identity", () => {
  const bytes = appZip();
  for (const expected of [
    { appId: "mp_ffffffffffffffff", version: manifest.version },
    { appId: manifest.appId, version: "9.9.9" },
  ]) {
    assert.throws(
      () => inspectBuild(bytes, expected),
      (error: unknown) =>
        error instanceof PackageError &&
        ["APP_ID_MISMATCH", "VERSION_MISMATCH"].includes(error.code),
    );
  }
});

test("build inspection rejects missing or invalid files", () => {
  const missingManifest = makeZip([{ name: "index.html", data: "x" }]);
  assert.throws(
    () => inspectBuild(missingManifest, manifest),
    (error: unknown) =>
      error instanceof PackageError && error.code === "MANIFEST_MISSING",
  );
  const missingEntry = makeZip([
    { name: "qchat.manifest.json", data: JSON.stringify(manifest) },
    { name: "other.html", data: "x" },
  ]);
  assert.throws(
    () => inspectBuild(missingEntry, manifest),
    (error: unknown) =>
      error instanceof PackageError && error.code === "ENTRY_MISSING",
  );
  const invalidJson = makeZip([
    { name: "qchat.manifest.json", data: "{" },
    { name: "index.html", data: "x" },
  ]);
  assert.throws(
    () => inspectBuild(invalidJson, manifest),
    (error: unknown) =>
      error instanceof PackageError && error.code === "MANIFEST_INVALID_JSON",
  );
});

test("manifest schema rejects unknown fields and unsafe values", () => {
  const base = {
    ...manifest,
    requestedPermissions: ["toast"],
  };
  assert.equal(miniappManifestSchema.safeParse(base).success, true);
  const cases = [
    { ...base, extra: true },
    { ...base, appId: "bad" },
    { ...base, version: "1.0" },
    { ...base, entry: "../index.html" },
    { ...base, entry: "index.js" },
    { ...base, requestedPermissions: ["admin"] },
    { ...base, schemaVersion: 2 },
    { ...base, name: "" },
  ];
  for (const value of cases)
    assert.equal(
      miniappManifestSchema.safeParse(value).success,
      false,
      JSON.stringify(value),
    );
});

test("permission catalog and API allowlist stay in sync", () => {
  assert.deepEqual(
    [...new Set(Object.values(miniappApiAllowlist))].sort(),
    ["qchat.api", "user.profile"],
  );
  for (const permission of Object.values(miniappApiAllowlist))
    assert.ok(miniappPermissionIds.includes(permission));
});

test("review preview serves stored files and injects the bridge into HTML", () => {
  const meta: PreviewMeta = {
    appId: manifest.appId,
    name: manifest.name,
    version: manifest.version,
    entry: "index.html",
    runtimeVersion: "1.0.0",
    minRuntimeVersion: manifest.minRuntimeVersion,
    permissions: manifest.requestedPermissions,
  };
  const zip = makeZip([
    { name: "qchat.manifest.json", data: JSON.stringify(manifest) },
    {
      name: "index.html",
      data: '<!doctype html><html><head><script src="./assets/app.js"></script></head><body><div id="root"></div></body></html>',
      method: 8,
    },
    { name: "assets/app.js", data: "console.log('preview')", method: 8 },
  ]);
  const page = readPreviewFile(zip, meta, "");
  assert.equal(page?.name, "index.html");
  assert.equal(page?.type, "text/html; charset=utf-8");
  const html = page!.bytes.toString("utf8");
  assert.ok(html.indexOf("__QCHAT_PREVIEW__") < html.indexOf("./assets/app.js"));
  const script = readPreviewFile(zip, meta, "assets/app.js");
  assert.equal(script?.type, "text/javascript; charset=utf-8");
  assert.equal(script?.bytes.toString("utf8"), "console.log('preview')");
  assert.equal(readPreviewFile(zip, meta, "missing.js"), null);
  assert.equal(previewContentType("assets/app.js"), "text/javascript; charset=utf-8");
  assert.equal(previewContentType("unknown.bin"), "application/octet-stream");
});

test("preview bridge escapes manifest strings and works without a head", () => {
  const meta: PreviewMeta = {
    appId: manifest.appId,
    name: "</script><img src=x onerror=alert(1)>",
    version: manifest.version,
    entry: "index.html",
    runtimeVersion: "1.0.0",
    minRuntimeVersion: manifest.minRuntimeVersion,
    permissions: [],
  };
  const injected = injectPreviewBridge("<html><head></head><body></body></html>", meta);
  assert.equal(injected.includes("</script><img"), false);
  const bare = injectPreviewBridge("<h1>hi</h1>", meta);
  assert.ok(bare.startsWith("<script>"));
  assert.ok(bare.endsWith("<h1>hi</h1>"));
});

test("filesystem build links are signed and expire", async () => {
  const previous = {
    endpoint: process.env.S3_ENDPOINT,
    access: process.env.S3_ACCESS_KEY,
    secret: process.env.S3_SECRET_KEY,
    signing: process.env.MINIAPP_SIGNING_SECRET,
  };
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_ACCESS_KEY;
  delete process.env.S3_SECRET_KEY;
  process.env.MINIAPP_SIGNING_SECRET = "test-secret-with-enough-entropy";
  try {
    const key = "miniapps/mp_0123456789abcdef/11111111-2222-3333-4444-555555555555.zip";
    const location = await buildLocation(key, "https://chat.example.com", 60);
    const url = new URL(location.url);
    assert.equal(url.pathname, "/api/miniapps/blob");
    assert.equal(url.searchParams.get("key"), key);
    const exp = url.searchParams.get("exp")!;
    const sig = url.searchParams.get("sig")!;
    assert.equal(verifyBlobToken(key, exp, sig), true);
    assert.equal(verifyBlobToken(key, exp, sig.replace(/^./, (c) => (c === "a" ? "b" : "a"))), false);
    assert.equal(verifyBlobToken(key, String(Number(exp) - 3600), sig), false);
    assert.equal(verifyBlobToken(`${key}x`, exp, sig), false);
    assert.equal(verifyBlobToken(key, "not-a-number", sig), false);
  } finally {
    for (const [name, value] of [
      ["S3_ENDPOINT", previous.endpoint],
      ["S3_ACCESS_KEY", previous.access],
      ["S3_SECRET_KEY", previous.secret],
      ["MINIAPP_SIGNING_SECRET", previous.signing],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
