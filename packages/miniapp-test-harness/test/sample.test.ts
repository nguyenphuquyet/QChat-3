import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MemoryDomAdapter,
  type MemorySnapshot,
} from "@qchat/miniapp-view-runtime";
import {
  HOST_TOAST_EVENT,
  MemoryStorageAdapter,
} from "@qchat/miniapp-service-runtime";
import { SampleError, createSampleHost, loadSample } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../miniapp-examples-v2/qchat-hello", import.meta.url));
const ROUTE = "pages/index/index";
const ABOUT = "pages/about/about";

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

/** The first element with this class that is attached to the live root. */
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

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("loads and compiles the sample package", () => {
  const sample = loadSample(ROOT);

  assert.deepEqual(sample.app.pages, [ROUTE, ABOUT]);
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
    saved: "",
    hasSaved: false,
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

test("a fixed light app ignores a dark host", () => {
  const host = createSampleHost(loadSample(ROOT), { hostTheme: "dark" });
  host.launch();

  assert.equal(host.sample.app.qxColorScheme, "light");
  assert.equal(host.theme(), "light", "a fixed scheme never follows the host");
  assert.equal((host.dom as MemoryDomAdapter).theme, "light");

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

test("navigateTo opens the about page and navigateBack restores the index state", () => {
  const host = createSampleHost(loadSample(ROOT));
  const dom = host.dom as MemoryDomAdapter;
  host.launch();

  dom.dispatch(handleByClass(dom, "increment"), "tap");
  dom.dispatch(handleByClass(dom, "increment"), "tap");
  assert.equal(host.data().count, 2);

  dom.dispatch(handleByClass(dom, "about"), "tap");
  assert.equal(host.route(), ABOUT);
  assert.deepEqual(host.pageStack(), [ROUTE, ABOUT]);
  const about = dom.snapshot().children[0];
  const detail = findByClass(about, "detail");
  assert.ok(detail);
  assert.equal(textOf(detail), "Opened with count 2");

  dom.dispatch(handleByClass(dom, "back"), "tap");
  assert.equal(host.route(), ROUTE);
  assert.deepEqual(host.pageStack(), [ROUTE]);
  assert.equal(host.data().count, 2, "the same index page is shown again");
  const index = dom.snapshot().children[0];
  assert.equal(textOf(findByClass(index, "count")!), "Count: 2");
  host.close();
});

test("save writes storage, shows a toast, and a relaunch restores the count", async () => {
  const storage = new MemoryStorageAdapter();
  const sample = loadSample(ROOT);
  const host = createSampleHost(sample, { storage });
  const dom = host.dom as MemoryDomAdapter;
  host.launch();

  dom.dispatch(handleByClass(dom, "increment"), "tap");
  dom.dispatch(handleByClass(dom, "save"), "tap");
  await settle();

  assert.equal(storage.read("hello.count"), "1");
  assert.equal(host.data().saved, "1");
  assert.equal(host.data().hasSaved, true);
  const saved = findByClass(dom.snapshot().children[0], "saved");
  assert.ok(saved);
  assert.equal(textOf(saved), "Saved: 1");
  assert.equal(host.events.at(-1)?.event, HOST_TOAST_EVENT);
  assert.equal(host.events.at(-1)?.payload.title, "Saved");
  host.close();

  const again = createSampleHost(sample, { storage });
  again.launch();
  assert.equal(again.data().count, 1);
  assert.equal(again.data().hasSaved, true);
  const restored = again.dom as MemoryDomAdapter;
  const restoredSaved = findByClass(restored.snapshot().children[0], "saved");
  assert.ok(restoredSaved);
  assert.equal(textOf(restoredSaved), "Saved: 1");
  again.close();
});
