import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileStorageAdapter,
  PackageStore,
  createAppPackage,
  createAppPackageFromDirectory,
  createPackage,
  renderWxml,
  reviveWxml,
  verifyPackage,
  type AppPackageResult,
  type PackageFileInput,
  type ViewBundle,
} from "../src/index.js";

const keys = generateKeyPairSync("ed25519");
const other = generateKeyPairSync("ed25519");
const PUBLIC: Record<string, KeyObject> = { "test-key": keys.publicKey };
const HELLO = join(process.cwd(), "..", "miniapp-examples-v2", "qchat-hello");

const SOURCES: Record<string, string> = {
  "app.json": JSON.stringify({ pages: ["pages/index/index"], qxColorScheme: "light" }),
  "app.js": "App({});",
  "app.wxss": ".page{color:#000}",
  "pages/index/index.wxml": '<view class="page">{{title}}</view>',
  "pages/index/index.wxss": ".page{padding:16rpx}",
  "pages/index/index.js": "Page({data:{title:'Hi'}});",
  "pages/index/index.json": '{"navigationBarTitleText":"Hi"}',
};

const OPTIONS = {
  appId: "qchat.hello",
  version: "1.0.0",
  name: "Hello",
  minRuntimeVersion: "0.1.0",
  keyId: "test-key",
  privateKey: keys.privateKey,
};

function read(path: string): string | null {
  return Object.hasOwn(SOURCES, path) ? SOURCES[path] : null;
}

function sourceFiles(): PackageFileInput[] {
  return Object.entries(SOURCES).map(([path, text]) => ({ path, bytes: Buffer.from(text, "utf8") }));
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function createApp(overrides: Partial<typeof OPTIONS> = {}): AppPackageResult {
  const result = createAppPackage(read, { ...OPTIONS, ...overrides });
  assert.equal(result.ok, true, result.error?.message);
  assert.ok(result.created);
  return result;
}

function build(files: PackageFileInput[], overrides: Partial<typeof OPTIONS> = {}) {
  return unwrap(createPackage(files, { ...OPTIONS, ...overrides }));
}

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "qchat-pkg-"));
}

test("a compiled package round-trips through create and verify", () => {
  const created = createApp().created!;
  assert.equal(created.bytes.subarray(0, 2).toString("latin1"), "PK");
  assert.equal(created.manifest.format, "qxpkg");
  assert.equal(created.manifest.appId, "qchat.hello");
  assert.equal(created.manifest.entry, "pages/index/index");
  assert.ok(created.manifest.files.some((file) => file.path === "build/view.json"));

  const verified = unwrap(verifyPackage(created.bytes, { publicKeys: PUBLIC, runtimeVersion: "0.1.0" }));
  assert.deepEqual(verified.manifest, created.manifest);
  assert.equal(verified.files.get("app.json")?.toString("utf8"), SOURCES["app.json"]);
  assert.equal(verified.files.size, created.manifest.files.length);

  const bundle = JSON.parse(verified.files.get("build/view.json")!.toString("utf8")) as ViewBundle;
  assert.equal(bundle.format, "qchat-view-bundle");
  assert.equal(bundle.formatVersion, 1);
  assert.deepEqual(Object.keys(bundle.pages), ["pages/index/index"]);
  assert.match(bundle.pages["pages/index/index"].css, /16 \* var\(--qchat-rpx/);

  const rendered = renderWxml(reviveWxml(bundle.pages["pages/index/index"].wxml), { title: "Hello" });
  assert.equal(rendered.ok, true);
  assert.match(JSON.stringify(rendered.ok ? rendered.value : null), /Hello/);
});

test("a wrong key or a tampered package is rejected", () => {
  const created = createApp().created!;
  const wrong = verifyPackage(created.bytes, { publicKeys: { "test-key": other.publicKey }, runtimeVersion: "0.1.0" });
  assert.equal(wrong.ok, false);
  assert.equal(!wrong.ok && wrong.error.code, "PACKAGE_SIGNATURE_INVALID");

  // Flip one byte near the end of the archive: the central directory or a
  // stored entry no longer matches its CRC, hash or signature.
  const tampered = Buffer.from(created.bytes);
  tampered[tampered.length - 60] ^= 0xff;
  const result = verifyPackage(tampered, { publicKeys: PUBLIC, runtimeVersion: "0.1.0" });
  assert.equal(result.ok, false);
  // The ZIP CRC is checked before the manifest hash, so either layer may catch
  // the edit; both mean the package is refused.
  assert.ok(
    !result.ok && ["PACKAGE_HASH_MISMATCH", "PACKAGE_FORMAT_UNSUPPORTED"].includes(result.error.code),
    !result.ok ? result.error.code : "verified",
  );
});

test("a package that needs a newer runtime is rejected", () => {
  const created = createApp({ minRuntimeVersion: "2.0.0" }).created!;
  const result = verifyPackage(created.bytes, { publicKeys: PUBLIC, runtimeVersion: "1.9.9" });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "PACKAGE_FORMAT_UNSUPPORTED");
});

test("unsafe paths, executables and a missing page file are rejected at build time", () => {
  const bundle = createApp().created!.manifest.files.find((file) => file.path === "build/view.json")!;
  const view = { path: bundle.path, bytes: Buffer.from("{}") };

  const unsafe = createPackage([...sourceFiles(), view, { path: "../evil.js", bytes: Buffer.from("x") }], OPTIONS);
  assert.equal(unsafe.ok, false);
  assert.equal(!unsafe.ok && unsafe.error.code, "PACKAGE_UNSAFE_PATH");

  const executable = createPackage([...sourceFiles(), view, { path: "tools/run.exe", bytes: Buffer.from("MZ") }], OPTIONS);
  assert.equal(executable.ok, false);
  assert.equal(!executable.ok && executable.error.code, "PACKAGE_FORMAT_UNSUPPORTED");

  const missing = createAppPackage(
    (path) => (path === "pages/index/index.wxml" ? null : read(path)),
    OPTIONS,
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.code, "COMPILER_DIAGNOSTIC");
});

test("install, upgrade, rollback and version retention", () => {
  const root = tempRoot();
  try {
    const store = new PackageStore(root, { publicKeys: PUBLIC, runtimeVersion: "0.1.0" });
    const first = unwrap(store.install(createApp().created!.bytes));
    assert.equal(first.manifest.version, "1.0.0");
    assert.equal(store.current("qchat.hello")?.manifest.version, "1.0.0");

    const second = unwrap(store.install(createApp({ version: "1.1.0" }).created!.bytes));
    assert.equal(second.manifest.version, "1.1.0");
    assert.deepEqual(store.readState("qchat.hello"), { current: "1.1.0", previous: "1.0.0" });
    assert.deepEqual(store.versions("qchat.hello"), ["1.1.0", "1.0.0"]);

    const rollback = store.rollback("qchat.hello");
    assert.equal(rollback.ok, true);
    assert.equal(store.current("qchat.hello")?.manifest.version, "1.0.0");
    assert.deepEqual(store.readState("qchat.hello"), { current: "1.0.0", previous: "1.1.0" });

    const installed = store.current("qchat.hello")!;
    const content = readFileSync(join(installed.directory, "pages/index/index.js"), "utf8");
    assert.equal(content, SOURCES["pages/index/index.js"]);
    const bundle = JSON.parse(readFileSync(join(installed.directory, "build/view.json"), "utf8")) as ViewBundle;
    assert.equal(renderWxml(reviveWxml(bundle.pages["pages/index/index"].wxml), { title: "Installed" }).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a downgrade and a revoked version are refused", () => {
  const root = tempRoot();
  try {
    const store = new PackageStore(root, { publicKeys: PUBLIC, runtimeVersion: "0.1.0" });
    assert.equal(store.install(createApp({ version: "1.1.0" }).created!.bytes).ok, true);

    const downgrade = store.install(createApp({ version: "1.0.0" }).created!.bytes);
    assert.equal(downgrade.ok, false);
    assert.equal(!downgrade.ok && downgrade.error.code, "PACKAGE_DOWNGRADE_BLOCKED");

    const revoked = new PackageStore(root, {
      publicKeys: PUBLIC,
      runtimeVersion: "0.1.0",
      revoked: ["qchat.hello@1.2.0"],
    });
    const blocked = revoked.install(createApp({ version: "1.2.0" }).created!.bytes);
    assert.equal(blocked.ok, false);
    assert.equal(!blocked.ok && blocked.error.code, "PACKAGE_REVOKED");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an oversized archive is rejected before reading its directory", () => {
  const created = createApp().created!;
  const result = verifyPackage(created.bytes, {
    publicKeys: PUBLIC,
    runtimeVersion: "0.1.0",
    limits: { maxArchiveBytes: 16 },
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "PACKAGE_TOO_LARGE");
});

test("per-app storage is isolated, quota-limited and corruption-aware", () => {
  const root = tempRoot();
  try {
    const first = new FileStorageAdapter(root, "qchat.one", 64);
    const second = new FileStorageAdapter(root, "qchat.two", 64);
    first.write("profile", '{"name":"Ada"}');
    assert.equal(first.read("profile"), '{"name":"Ada"}');
    assert.equal(second.read("profile"), null, "another app cannot read the key");
    assert.deepEqual(first.entries(), [["profile", '{"name":"Ada"}']]);

    assert.throws(() => first.write("big", `"${"x".repeat(80)}"`), /quota/i);
    assert.throws(() => first.read("bad\u0000key"), /key/i);

    first.remove("profile");
    assert.equal(first.read("profile"), null);
    first.write("a", "1");
    first.clear();
    assert.deepEqual(first.entries(), []);

    first.write("ok", "1");
    const path = join(root, "storage", "qchat.one");
    const name = readdirSync(path)[0] as string;
    writeFileSync(join(path, name), "{not json");
    assert.throws(() => first.read("ok"), /corrupt|decode/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a directory package ships binary assets and ignores stale build output", () => {
  const root = tempRoot();
  try {
    const sourceRoot = join(root, "source");
    mkdirSync(join(sourceRoot, "pages/index"), { recursive: true });
    mkdirSync(join(sourceRoot, "assets"), { recursive: true });
    mkdirSync(join(sourceRoot, "build"), { recursive: true });
    for (const [path, text] of Object.entries(SOURCES)) {
      mkdirSync(join(sourceRoot, path, ".."), { recursive: true });
      writeFileSync(join(sourceRoot, path), text);
    }
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    writeFileSync(join(sourceRoot, "assets/icon.png"), png);
    writeFileSync(join(sourceRoot, "build/view.json"), "{\"stale\":true}");

    const result = createAppPackageFromDirectory(sourceRoot, OPTIONS);
    assert.equal(result.ok, true, result.error?.message);
    const verified = unwrap(verifyPackage(result.created!.bytes, { publicKeys: PUBLIC, runtimeVersion: "0.1.0" }));
    assert.deepEqual(verified.files.get("assets/icon.png"), png);
    const bundle = JSON.parse(verified.files.get("build/view.json")!.toString("utf8")) as ViewBundle;
    assert.equal(bundle.format, "qchat-view-bundle");
    assert.equal(Object.hasOwn(bundle, "stale"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the qchat-hello sample compiles, installs and renders from the installed bundle", () => {
  const root = tempRoot();
  try {
    const result = createAppPackageFromDirectory(HELLO, {
      ...OPTIONS,
      appId: "qchat.hello",
      name: "QChat Hello",
    });
    assert.equal(result.ok, true, result.error?.message);
    assert.deepEqual(Object.keys(result.bundle!.pages), ["pages/index/index", "pages/about/about"]);

    const store = new PackageStore(root, { publicKeys: PUBLIC, runtimeVersion: "0.1.0" });
    const installed = unwrap(store.install(result.created!.bytes));
    const bundle = JSON.parse(readFileSync(join(installed.directory, "build/view.json"), "utf8")) as ViewBundle;
    const page = bundle.pages["pages/index/index"];
    assert.match(page.css, /--qchat-rpx/);

    const rendered = renderWxml(reviveWxml(page.wxml), {
      title: "QChat Hello",
      count: 2,
      items: ["a", "b"],
      hasSaved: true,
      saved: 2,
    });
    assert.equal(rendered.ok, true, rendered.ok ? "" : rendered.diagnostics[0]?.message);
    const tree = rendered.ok ? rendered.value : null;
    assert.match(JSON.stringify(tree), /Count: 2/);
    assert.match(JSON.stringify(tree), /Tapped 2 time\(s\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
