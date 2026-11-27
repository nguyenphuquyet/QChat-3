import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MemoryDomAdapter,
  type MemorySnapshot,
} from "@qchat/miniapp-view-runtime";
import { SampleError, createSampleHost, loadSample } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../miniapp-examples-v2/qchat-hello", import.meta.url));
const ROUTE = "pages/index/index";

function textOf(node: MemorySnapshot): string {
  return node.children.map((child) => child.text ?? textOf(child)).join("");
}

function findByClass(node: MemorySnapshot, className: string): MemorySnapshot | null {
  if (node.attrs.class === className) return node;
  for (const child of node.children) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function textHandle(dom: MemoryDomAdapter, text: string): string {
  for (const [handle, node] of dom.nodes) {
    if (node.tag === "#text" && node.text === text) return handle;
  }
  throw new Error(`no text node ${JSON.stringify(text)}`);
}

test("loads and compiles the sample package", () => {
  const sample = loadSample(ROOT);

  assert.deepEqual(sample.app.pages, [ROUTE]);
  assert.equal(sample.app.qxColorScheme, "light");
  const page = sample.pages.get(ROUTE);
  assert.ok(page, "the declared page must be compiled");
  assert.deepEqual(page.config, { navigationBarTitleText: "Hello" });

  const css = page.css;
  assert.match(css, /\.page\{box-sizing:border-box\}/, "app.wxss imports are inlined");
  assert.match(
    css,
    /gap:calc\(24 \* var\(--qchat-rpx, calc\(100vw \/ 750\)\)\)/,
    "rpx compiles to the documented calc()",
  );
  assert.match(css, /\[data-theme="dark"\] \.page\{background:#111827/, "theme selectors are preserved");
  assert.doesNotMatch(css, /prefers-color-scheme/, "the compiler must not emit a media-query theme");
  assert.doesNotMatch(css, /\drpx\b/, "no rpx unit survives compilation");
});

test("launches the first page and renders the initial tree", () => {
  const host = createSampleHost(loadSample(ROOT));
  host.launch();

  assert.equal(host.route(), ROUTE);
  assert.equal(host.theme(), "light");
  assert.equal((host.dom as MemoryDomAdapter).theme, "light");
  assert.deepEqual(host.data(), {
    title: "QChat Hello",
    count: 0,
    items: ["WXML", "WXSS", "JavaScript"],
  });

  const page = (host.dom as MemoryDomAdapter).snapshot().children[0];
  assert.equal(page.tag, "wx-view");
  assert.equal(page.attrs.class, "page");
  assert.equal(findByClass(page, "title") && textOf(findByClass(page, "title")!), "QChat Hello");
  assert.equal(findByClass(page, "count") && textOf(findByClass(page, "count")!), "Count: 0");
  assert.equal(findByClass(page, "status"), null, "wx:if must not render a false branch");

  const items = page.children[3].children.map((child) => textOf(child));
  assert.deepEqual(items, ["0: WXML", "1: WXSS", "2: JavaScript"]);

  host.close();
});

test("a tap runs the page handler and patches only the changed paths", () => {
  const host = createSampleHost(loadSample(ROOT));
  const dom = host.dom as MemoryDomAdapter;
  host.launch();

  const countHandle = textHandle(dom, "Count: 0");
  const buttonHandle = dom.handleForTag("wx-button");
  const nodesBeforeTap = dom.nodes.size;

  dom.dispatch(buttonHandle, "tap");

  assert.equal(host.data().count, 1, "the handler runs inside the engine");
  assert.equal(dom.nodes.get(countHandle)?.text, "Count: 1", "the count text node is updated in place");
  assert.equal(dom.nodes.get(buttonHandle)?.tag, "wx-button", "the button is not recreated");

  const page = dom.snapshot().children[0];
  const status = findByClass(page, "status");
  assert.ok(status, "wx:if renders the status once count > 0");
  assert.equal(textOf(status), "Tapped 1 time(s)");

  // The status branch adds exactly two nodes (view + text); the rest of the
  // page was patched, not rebuilt.
  assert.equal(dom.nodes.size, nodesBeforeTap + 2, "only the inserted branch is created");
  assert.equal(dom.snapshot().children.length, 1, "the page root is never reloaded");

  dom.dispatch(buttonHandle, "tap");

  assert.equal(host.data().count, 2);
  assert.equal(dom.nodes.get(countHandle)?.text, "Count: 2");
  const updatedStatus = findByClass(dom.snapshot().children[0], "status");
  assert.ok(updatedStatus);
  assert.equal(textOf(updatedStatus), "Tapped 2 time(s)");
  assert.equal(dom.nodes.size, nodesBeforeTap + 2, "the second tap creates no nodes");

  host.close();
});

test("the sample data is a snapshot, not the live page state", () => {
  const host = createSampleHost(loadSample(ROOT));
  host.launch();

  const first = host.data();
  (first as { count: number }).count = 99;
  assert.equal(host.data().count, 0);

  host.close();
});

test("a closed host refuses further work", () => {
  const host = createSampleHost(loadSample(ROOT));
  host.launch();
  host.close();

  assert.throws(() => host.dispatch({ handler: "onIncrement", type: "tap", detail: {}, dataset: {}, catch: false, timeStamp: 0 }), SampleError);
  assert.throws(() => host.launch(), /already launched|closed/);
});

test("an unknown page route is rejected before the engine starts", () => {
  const host = createSampleHost(loadSample(ROOT));
  assert.throws(() => host.launch("pages/missing/missing"), /unknown page/);
  host.close();
});
