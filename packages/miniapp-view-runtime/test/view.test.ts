import assert from "node:assert/strict";
import { test } from "node:test";
import type { RenderNode, ViewEvent } from "@qchat/miniapp-contracts";
import { createViewRenderer } from "../src/index.js";
import { FakeDomAdapter } from "./fake-dom.js";

function page(count = 0): RenderNode {
  return {
    type: "element",
    tag: "wx-view",
    props: { class: "page", hidden: false },
    children: [
      { type: "element", tag: "wx-text", props: {}, children: [{ type: "text", text: `count:${count}` }] },
      {
        type: "element",
        tag: "wx-button",
        props: { type: "primary", disabled: false },
        dataset: { action: "increment" },
        events: { tap: { handler: "onTap" } },
        children: [{ type: "text", text: "add" }],
      },
    ],
  };
}

test("renders a tree through the DOM adapter without HTML", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  view.render(page(0));
  const snapshot = dom.snapshot();
  assert.equal(snapshot.children.length, 1);
  const root = snapshot.children[0];
  assert.equal(root.tag, "wx-view");
  assert.deepEqual(root.attrs, { class: "page" });
  assert.equal(root.children[0].tag, "wx-text");
  assert.equal(root.children[0].children[0].text, "count:0");
  assert.equal(root.children[1].attrs.type, "primary");
  assert.equal(view.currentTree() !== null, true);
});

test("a data update reuses the same nodes instead of reloading the page", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  view.render(page(0));
  const created = dom.createdTags.length;
  const textHandle = dom.handleForTag("#text");
  view.render(page(1));
  assert.equal(dom.createdTags.length, created);
  assert.equal(dom.nodes.get(textHandle)?.text, "count:1");
  assert.equal(dom.snapshot().children.length, 1);
});

test("a tap is forwarded with the handler name and dataset", () => {
  const dom = new FakeDomAdapter();
  const events: ViewEvent[] = [];
  const view = createViewRenderer(dom, { onEvent: (event) => events.push(event), now: () => 42 });
  view.render(page(0));
  dom.dispatch(dom.handleForTag("wx-button"), "tap", { x: 1 });
  assert.equal(events.length, 1);
  assert.equal(events[0].handler, "onTap");
  assert.equal(events[0].type, "tap");
  assert.deepEqual(events[0].dataset, { action: "increment" });
  assert.deepEqual(events[0].detail, { x: 1 });
  assert.equal(events[0].timeStamp, 42);
  assert.equal(events[0].catch, false);
});

test("the dataset is fresh after an update", () => {
  const dom = new FakeDomAdapter();
  const events: ViewEvent[] = [];
  const view = createViewRenderer(dom, { onEvent: (event) => events.push(event) });
  view.render(page(0));
  const next = page(1);
  const button = (next as Extract<RenderNode, { type: "element" }>).children[1] as Extract<RenderNode, { type: "element" }>;
  button.dataset = { action: "increment", row: "7" };
  view.render(next);
  dom.dispatch(dom.handleForTag("wx-button"), "tap");
  assert.deepEqual(events[0].dataset, { action: "increment", row: "7" });
});

test("the resolved theme is written to the page root only", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  view.setTheme("dark");
  assert.equal(dom.theme, "dark");
  assert.equal(view.theme(), "dark");
});

test("patch applies typed operations and still diffs", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  view.render(page(0));
  const created = dom.createdTags.length;
  view.patch([
    { op: "setText", path: [0, 0], text: "count:9" },
    { op: "setProp", path: [1], name: "type", value: "warn" },
  ]);
  assert.equal(dom.createdTags.length, created);
  assert.equal(dom.snapshot().children[0].children[0].children[0].text, "count:9");
  assert.equal(dom.snapshot().children[0].children[1].attrs.type, "warn");
});

test("patch does not depend on structuredClone (the minimum WebView has none)", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  view.render(page(0));
  const original = globalThis.structuredClone;
  try {
    Object.defineProperty(globalThis, "structuredClone", { value: undefined, configurable: true, writable: true });
    view.patch([{ op: "setText", path: [0, 0], text: "count:5" }]);
  } finally {
    Object.defineProperty(globalThis, "structuredClone", { value: original, configurable: true, writable: true });
  }
  assert.equal(dom.snapshot().children[0].children[0].children[0].text, "count:5");
});

test("an unsafe tree is rejected before touching the DOM", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  assert.throws(() => view.render({ type: "element", tag: "script", props: {}, children: [] }), /invalid render tree/);
  assert.equal(dom.createdTags.length, 0);
});

test("destroy removes every node and listener", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  view.render(page(0));
  view.destroy();
  assert.equal(dom.snapshot().children.length, 0);
  assert.throws(() => view.render(page(1)), /destroyed/);
});
