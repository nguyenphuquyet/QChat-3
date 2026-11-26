import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import {
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
  createPreviewToken,
  previewContentType,
  readRawPreviewFile,
  verifyPreviewToken,
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

function webappZip(options: {
  overrides?: Record<string, unknown>;
  indexHtml?: string;
  entryHtml?: string;
  extra?: Entry[];
  asset?: { path: string; data: string };
} = {}) {
  const indexHtml =
    options.indexHtml ?? "<!doctype html><html><body><div id=\"root\"></div></body></html>";
  const entryHtml = options.entryHtml ?? indexHtml;
  const hash = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");
  const manifest = {
    schemaVersion: 3,
    format: "webapp",
    name: "Web App",
    description: "A static web package",
    version: "1.0.0",
    entry: "index.html",
    minRuntimeVersion: "2.0.0",
    requestedPermissions: ["toast"] as string[],
    ...options.overrides,
  };
  const requestedPermissions =
    (manifest.requestedPermissions as string[] | undefined) ?? [];
  const asset = options.asset ?? {
    path: "assets/app.js",
    data: "console.log('webapp')",
  };
  const files = [
    { path: "manifest.json", data: Buffer.from(JSON.stringify(manifest)) },
    { path: "index.html", data: Buffer.from(entryHtml) },
    { path: asset.path, data: Buffer.from(asset.data) },
  ];
  const metadata = {
    formatVersion: 2,
    builderVersion: "3.0.0",
    version: manifest.version,
    entry: "index.html",
    builtAt: new Date().toISOString(),
    entrySha256: hash(indexHtml),
    files: files.map((file) => ({
      path: file.path,
      sha256: hash(file.data),
      size: file.data.length,
    })),
  };
  return makeZip([
    ...files.map((file) => ({ name: file.path, data: file.data })),
    { name: "metadata.json", data: JSON.stringify(metadata) },
    {
      name: "permissions.json",
      data: JSON.stringify({ requestedPermissions }),
    },
    ...(options.extra ?? []),
  ]);
}

const limits: ZipLimits = { ...buildLimits };

test("ZIP reader accepts a stored and deflated build", () => {
  const bytes = makeZip([
    { name: "manifest.json", data: '{"schemaVersion":2}' },
    { name: "assets/app.js", data: "console.log('qchat')", method: 8 },
  ]);
  const entries = readZip(bytes, limits);
  assert.equal(entries.length, 2);
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
    "./app.js",
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
    { name: "app.js", data: "a" },
    { name: "APP.js", data: "b" },
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
    { name: "manifest.json", data: '{"schemaVersion":2}' },
    { name: "app.js", data: "hello world" },
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

test("legacy WebView packages are rejected", () => {
  const bytes = makeZip([
    {
      name: "manifest.json",
      data: JSON.stringify({
        schemaVersion: 1,
        name: "Legacy",
        version: "1.0.0",
        entry: "index.html",
        minRuntimeVersion: "1.0.0",
        requestedPermissions: ["toast"],
      }),
    },
    { name: "index.html", data: "<!doctype html><h1>legacy</h1>" },
  ]);
  assert.throws(
    () => inspectBuild(bytes, { version: "1.0.0" }),
    (error: unknown) =>
      error instanceof PackageError && error.code === "MANIFEST_INVALID",
  );
});

test("webapp inspection rejects an archive without a manifest", () => {
  const bytes = makeZip([{ name: "index.html", data: "x" }]);
  assert.throws(
    () => inspectBuild(bytes, { version: "1.0.0" }),
    (error: unknown) =>
      error instanceof PackageError && error.code === "MANIFEST_MISSING",
  );
});

test("webapp inspection verifies the bundle and owns the app id", () => {
  const bytes = webappZip();
  const inspected = inspectBuild(bytes, { version: "1.0.0" });
  assert.equal(inspected.format, "webapp");
  assert.equal(inspected.entry, "index.html");
  assert.equal(inspected.sdkVersion, null);
  assert.deepEqual(inspected.permissions, ["toast"]);
  assert.equal(
    (inspected.manifest as Record<string, unknown>).buildHash,
    undefined,
  );
  assert.equal(
    (inspected.manifest as Record<string, unknown>).appId,
    undefined,
  );
  assert.equal(
    inspected.sha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
});

test("webapp inspection rejects appId, bad permissions and tampered files", () => {
  assert.throws(
    () =>
      inspectBuild(webappZip({ overrides: { appId: "mp_0123456789abcdef" } }), {
        version: "1.0.0",
      }),
    (error: unknown) =>
      error instanceof PackageError && error.code === "MANIFEST_INVALID",
  );
  assert.throws(
    () =>
      inspectBuild(
        webappZip({ overrides: { requestedPermissions: ["admin"] } }),
        { version: "1.0.0" },
      ),
    (error: unknown) =>
      error instanceof PackageError && error.code === "MANIFEST_INVALID",
  );
  assert.throws(
    () =>
      inspectBuild(webappZip({ entryHtml: "<!doctype html><h1>tampered</h1>" }), {
        version: "1.0.0",
      }),
    (error: unknown) =>
      error instanceof PackageError && error.code === "METADATA_MISMATCH",
  );
  assert.throws(
    () =>
      inspectBuild(
        webappZip({ extra: [{ name: "notes.txt", data: "unexpected" }] }),
        { version: "1.0.0" },
      ),
    (error: unknown) =>
      error instanceof PackageError && error.code === "UNEXPECTED_FILE",
  );
  assert.throws(
    () => inspectBuild(webappZip(), { version: "9.9.9" }),
    (error: unknown) =>
      error instanceof PackageError && error.code === "VERSION_MISMATCH",
  );
});

test("webapp inspection accepts the network permission without a host list", () => {
  const bytes = webappZip({
    overrides: {
      requestedPermissions: ["network", "storage"],
    },
  });
  const inspected = inspectBuild(bytes, { version: "1.0.0" });
  assert.equal(inspected.format, "webapp");
  assert.deepEqual(inspected.permissions, ["network", "storage"]);
});

test("webapp inspection rejects the removed host allowlist field", () => {
  const bytes = webappZip({
    overrides: {
      requestedPermissions: ["network"],
      networkDomains: ["api.example.com"],
    },
  });
  assert.throws(
    () => inspectBuild(bytes, { version: "1.0.0" }),
    (error: unknown) =>
      error instanceof PackageError && error.code === "MANIFEST_INVALID",
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

test("review preview returns raw stored files without executing them", () => {
  const zip = webappZip({ indexHtml: "<!doctype html><h1>preview</h1>" });
  const manifestFile = readRawPreviewFile(zip, "manifest.json");
  assert.equal(manifestFile?.name, "manifest.json");
  assert.equal(manifestFile?.type, "application/json; charset=utf-8");
  const parsed = JSON.parse(manifestFile!.bytes.toString("utf8"));
  assert.equal(parsed.format, "webapp");
  assert.equal(parsed.appId, undefined);

  const script = readRawPreviewFile(zip, "assets/app.js");
  assert.equal(script?.type, "text/javascript; charset=utf-8");
  assert.equal(script?.bytes.toString("utf8"), "console.log('webapp')");

  assert.equal(readRawPreviewFile(zip, "missing.js"), null);
  assert.equal(
    previewContentType("assets/app.js"),
    "text/javascript; charset=utf-8",
  );
  assert.equal(previewContentType("unknown.bin"), "application/octet-stream");
});

test("preview tokens are signed, build-scoped and expire", () => {
  const previous = process.env.MINIAPP_SIGNING_SECRET;
  process.env.MINIAPP_SIGNING_SECRET = "preview-token-test-secret";
  try {
    const versionId = "11111111-2222-3333-4444-555555555555";
    const { token, expiresAt } = createPreviewToken(versionId, 60);
    assert.ok(Date.parse(expiresAt) > Date.now());
    assert.equal(verifyPreviewToken(versionId, token), true);
    assert.equal(
      verifyPreviewToken("99999999-2222-3333-4444-555555555555", token),
      false,
    );
    const tampered =
      token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    assert.equal(verifyPreviewToken(versionId, tampered), false);
    assert.equal(
      verifyPreviewToken(versionId, createPreviewToken(versionId, -1).token),
      false,
    );
    assert.equal(verifyPreviewToken(versionId, "not-a-token"), false);
  } finally {
    if (previous === undefined) delete process.env.MINIAPP_SIGNING_SECRET;
    else process.env.MINIAPP_SIGNING_SECRET = previous;
  }
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
