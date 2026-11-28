import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PackageStore, createAppPackageFromDirectory } from "@qchat/miniapp-compiler";
import { MemoryDomAdapter } from "@qchat/miniapp-view-runtime";
import { createSampleHost, loadInstalledPackage, loadSample, type SampleHost } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../miniapp-examples-v2/qchat-components", import.meta.url));
const ROUTE = "pages/index/index";

function handleByClass(dom: MemoryDomAdapter, className: string): string {
  const visit = (handle: string): string | null => {
    const node = dom.nodes.get(handle);
    if (!node) return null;
    if (node.attrs.get("class") === className) return handle;
    for (const child of node.children) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  for (const child of dom.nodes.get(dom.root)?.children ?? []) {
    const found = visit(child);
    if (found) return found;
  }
  throw new Error(`no element with class ${JSON.stringify(className)}`);
}

function textOf(dom: MemoryDomAdapter, className: string): string {
  const handle = handleByClass(dom, className);
  const node = dom.nodes.get(handle);
  if (!node) throw new Error("missing node");
  return node.children
    .map((child) => dom.nodes.get(child)?.text ?? "")
    .join("");
}

test("a custom component renders its properties, both slots and its own state", () => {
  const host = createSampleHost(loadSample(ROOT));
  try {
    host.launch();
    const dom = host.dom as MemoryDomAdapter;
    assert.equal(textOf(dom, "title"), "Hello / 0");
    assert.equal(textOf(dom, "heading"), "Head");
    assert.equal(textOf(dom, "body"), "Body 0");
    assert.equal(textOf(dom, "taps"), "0");
    assert.equal(textOf(dom, "clicks"), "Clicks: 0");

    // The wrapper is marked with the component path, which is what scopes its WXSS.
    const wrapper = dom.nodes.get(dom.handleForTag("wx-my-card"));
    assert.equal(wrapper?.attrs.get("data-qchat-component"), "components/card/card");
  } finally {
    host.close();
  }
});

test("a component method sets its data and its event reaches the page", () => {
  const host = createSampleHost(loadSample(ROOT));
  try {
    host.launch();
    const dom = host.dom as MemoryDomAdapter;
    dom.dispatch(handleByClass(dom, "add"), "tap");

    assert.equal(textOf(dom, "taps"), "1");
    assert.equal(host.data().clicks, 1);
    assert.equal(textOf(dom, "clicks"), "Clicks: 1");
  } finally {
    host.close();
  }
});

test("a page data change re-renders the component property", () => {
  const host = createSampleHost(loadSample(ROOT));
  try {
    host.launch();
    const dom = host.dom as MemoryDomAdapter;
    dom.dispatch(handleByClass(dom, "inc"), "tap");

    assert.equal(host.data().count, 1);
    assert.equal(textOf(dom, "title"), "Hello / 1");
    assert.equal(textOf(dom, "body"), "Body 1");
  } finally {
    host.close();
  }
});

test("component WXSS is scoped to the component wrapper", () => {
  const sample = loadSample(ROOT);
  const page = sample.pages.get(ROUTE);
  assert.ok(page);
  const css = page.css;
  assert.match(css, /\[data-qchat-component="components\/card\/card"\]\s*\{/);
  assert.match(css, /\[data-qchat-component="components\/card\/card"\] \.card\s*\{/);
  // A page rule is not scoped: the page owns the element it styles.
  assert.match(css, /\.clicks\s*\{/);
});

test("an installed package runs a custom component from its bundle", () => {
  const root = mkdtempSync(join(tmpdir(), "qchat-components-"));
  let host: SampleHost | null = null;
  try {
    const keys = generateKeyPairSync("ed25519");
    const built = createAppPackageFromDirectory(ROOT, {
      appId: "qchat.components",
      version: "1.0.0",
      name: "QChat Components",
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

    host = createSampleHost(loadInstalledPackage(installed.value.directory));
    host.launch();
    const dom = host.dom as MemoryDomAdapter;
    assert.equal(textOf(dom, "title"), "Hello / 0");

    dom.dispatch(handleByClass(dom, "add"), "tap");
    assert.equal(textOf(dom, "taps"), "1");
    assert.equal(textOf(dom, "clicks"), "Clicks: 1");
  } finally {
    host?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
