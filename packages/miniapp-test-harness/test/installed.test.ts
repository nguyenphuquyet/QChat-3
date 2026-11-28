import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PackageStore, createAppPackageFromDirectory } from "@qchat/miniapp-compiler";
import { MemoryDomAdapter } from "@qchat/miniapp-view-runtime";
import { createSampleHost, loadInstalledPackage, type SampleHost } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../miniapp-examples-v2/qchat-hello", import.meta.url));
const ROUTE = "pages/index/index";

function buildAndInstall(root: string): SampleHost {
  const keys = generateKeyPairSync("ed25519");
  const built = createAppPackageFromDirectory(ROOT, {
    appId: "qchat.hello",
    version: "1.0.0",
    name: "QChat Hello",
    minRuntimeVersion: "0.1.0",
    keyId: "test-key",
    privateKey: keys.privateKey,
  });
  assert.equal(built.ok, true, built.error?.message);
  const store = new PackageStore(root, {
    publicKeys: { "test-key": keys.publicKey },
    runtimeVersion: "0.1.0",
  });
  const installed = store.install(built.created!.bytes);
  if (!installed.ok) throw new Error(installed.error.message);

  const sample = loadInstalledPackage(installed.value.directory);
  return createSampleHost(sample);
}

test("an installed package runs from its compiled bundle, without the compiler", () => {
  const root = mkdtempSync(join(tmpdir(), "qchat-installed-"));
  let host: SampleHost | null = null;
  try {
    host = buildAndInstall(root);
    host.launch();
    assert.equal(host.route(), ROUTE);

    const dom = host.dom as MemoryDomAdapter;
    const page = dom.snapshot().children[0];
    assert.equal(page.attrs.class, "page");
    assert.match(JSON.stringify(page), /Count: 0/);

    const button = dom.handleForTag("wx-button");
    dom.dispatch(button, "tap");
    assert.equal(host.data().count, 1);
    assert.match(JSON.stringify(dom.snapshot()), /Count: 1/);
  } finally {
    host?.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a bundle whose pages do not match app.json is refused", () => {
  const root = mkdtempSync(join(tmpdir(), "qchat-installed-"));
  try {
    const host = buildAndInstall(root);
    const directory = host.sample.root;
    host.close();

    const bundlePath = join(directory, "build/view.json");
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as { pages: Record<string, unknown> };
    delete bundle.pages["pages/about/about"];
    writeFileSync(bundlePath, JSON.stringify(bundle));

    assert.throws(() => loadInstalledPackage(directory), /do not match app\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a package without a compiled bundle is refused instead of compiling sources", () => {
  assert.throws(() => loadInstalledPackage(ROOT), /build\/view\.json is missing/);
});
