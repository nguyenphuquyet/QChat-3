import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseManifest,
  canonicalJson,
  signableManifest,
  satisfiesRuntime,
  DEFAULT_COLOR_SCHEME,
  resolveTheme,
  followsHost,
  maySendHostTheme,
  themeRootValues,
  type MiniAppManifest,
} from "../src/index.js";

const sha = "a".repeat(64);

function filesFor(pages: string[]) {
  const files = [
    { path: "app.js", sha256: sha, bytes: 10 },
    { path: "app.json", sha256: sha, bytes: 10 },
    { path: "build/view.json", sha256: sha, bytes: 10 },
  ];
  for (const page of pages) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      files.push({ path: `${page}.${ext}`, sha256: sha, bytes: 10 });
    }
  }
  return files;
}

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: "qxpkg",
    formatVersion: 1,
    appId: "qchat.hello",
    version: "1.0.0",
    name: "Hello",
    minRuntimeVersion: "0.1.0",
    entry: "pages/index/index",
    pages: ["pages/index/index"],
    permissions: ["storage", "network"],
    qxColorScheme: "light",
    files: filesFor(["pages/index/index"]),
    signature: { algorithm: "Ed25519", value: "c2ln", keyId: "k1" },
    ...overrides,
  };
}

test("accepts a valid manifest", () => {
  const result = parseManifest(manifest());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.manifest.appId, "qchat.hello");
    assert.equal(result.manifest.qxColorScheme, "light");
  }
});

test("defaults the theme to light when omitted", () => {
  const value = manifest();
  delete value.qxColorScheme;
  const result = parseManifest(value);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.manifest.qxColorScheme, DEFAULT_COLOR_SCHEME);
});

test("rejects an invalid theme value", () => {
  const result = parseManifest(manifest({ qxColorScheme: "sepia" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "THEME_INVALID_VALUE");
});

test("rejects an unsafe file path", () => {
  const value = manifest();
  (value.files as Array<Record<string, unknown>>).push({ path: "../escape.js", sha256: sha, bytes: 1 });
  const result = parseManifest(value);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MANIFEST_INVALID");
});

test("rejects a manifest that lists itself", () => {
  const value = manifest();
  (value.files as Array<Record<string, unknown>>).push({ path: "manifest.json", sha256: sha, bytes: 1 });
  const result = parseManifest(value);
  assert.equal(result.ok, false);
});

test("rejects an unknown permission", () => {
  const result = parseManifest(manifest({ permissions: ["telepathy"] }));
  assert.equal(result.ok, false);
});

test("rejects an entry that is not a declared page", () => {
  const result = parseManifest(manifest({ entry: "pages/other/other" }));
  assert.equal(result.ok, false);
});

test("rejects a declared page with a missing source file", () => {
  const value = manifest();
  value.files = (value.files as Array<Record<string, unknown>>).filter((file) => file.path !== "pages/index/index.wxml");
  const result = parseManifest(value);
  assert.equal(result.ok, false);
});

test("accepts a page without JSON or WXSS and rejects a package without a view bundle", () => {
  const lean = manifest();
  lean.files = (lean.files as Array<Record<string, unknown>>).filter(
    (file) => file.path !== "pages/index/index.json" && file.path !== "pages/index/index.wxss",
  );
  assert.equal(parseManifest(lean).ok, true);

  const noBundle = manifest();
  noBundle.files = (noBundle.files as Array<Record<string, unknown>>).filter((file) => file.path !== "build/view.json");
  const result = parseManifest(noBundle);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error.message, /view bundle/);
});

test("rejects an unsupported format version", () => {
  const result = parseManifest(manifest({ formatVersion: 2 }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MANIFEST_VERSION_UNSUPPORTED");
});

test("rejects an unknown manifest key", () => {
  const result = parseManifest(manifest({ extra: 1 }));
  assert.equal(result.ok, false);
});

test("canonical JSON is stable across key order", () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] }), '{"a":[2,{"c":3,"d":4}],"b":1}');
});

test("the signed bytes exclude the signature", () => {
  const result = parseManifest(manifest());
  assert.equal(result.ok, true);
  if (result.ok) {
    const signable = signableManifest(result.manifest) as Record<string, unknown>;
    assert.equal("signature" in signable, false);
    assert.equal(signable.appId, "qchat.hello");
  }
});

test("runtime version comparison", () => {
  assert.equal(satisfiesRuntime("0.1.0", "0.1.0"), true);
  assert.equal(satisfiesRuntime("0.1.0", "0.2.0"), true);
  assert.equal(satisfiesRuntime("1.0.0", "0.9.9"), false);
  assert.equal(satisfiesRuntime("0.1.0", "0.0.9"), false);
});

test("theme resolution: fixed declarations ignore the host", () => {
  assert.equal(resolveTheme({ app: "light" }, "dark"), "light");
  assert.equal(resolveTheme({ app: "dark" }, "light"), "dark");
  assert.equal(resolveTheme({ app: "auto" }, "dark"), "dark");
  assert.equal(resolveTheme({ app: "light", page: "auto" }, "dark"), "dark");
  assert.equal(resolveTheme({ app: "auto", page: "dark" }, "light"), "dark");
});

test("host theme events are only allowed for auto pages", () => {
  assert.equal(followsHost({ app: "auto" }), true);
  assert.equal(maySendHostTheme({ app: "light" }), false);
  assert.equal(maySendHostTheme({ app: "dark" }), false);
  assert.equal(maySendHostTheme({ app: "auto" }), true);
});

test("page root values carry data-theme and color-scheme", () => {
  assert.deepEqual(themeRootValues("dark"), { "data-theme": "dark", colorScheme: "dark" });
});

test("a parsed manifest round-trips through the signable form", () => {
  const result = parseManifest(manifest());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const signable = signableManifest(result.manifest);
  const reparsed = parseManifest({ ...signable, signature: result.manifest.signature } as MiniAppManifest);
  assert.equal(reparsed.ok, true);
});
