import assert from "node:assert/strict";
import { test } from "node:test";
import type { ElementNode, RenderOp, RenderPayload } from "@qchat/miniapp-contracts";
import { createRenderSession, createViewRenderer } from "../src/index.js";
import { FakeDomAdapter } from "./fake-dom.js";

function pageTree(value: string): ElementNode {
  return {
    type: "element",
    tag: "wx-view",
    props: { class: "page" },
    children: [
      { type: "element", tag: "wx-text", props: {}, children: [{ type: "text", text: value }] },
    ],
  };
}

function treePayload(seq: number, pageId: string, value: string, theme: "light" | "dark" = "light"): RenderPayload {
  return { pageId, seq, update: { kind: "tree", tree: pageTree(value), theme } };
}

function opsPayload(seq: number, pageId: string, ops: RenderOp[], theme: "light" | "dark" = "light"): RenderPayload {
  return { pageId, seq, update: { kind: "ops", ops, theme } };
}

function textHandle(dom: FakeDomAdapter): string {
  for (const [handle, node] of dom.nodes) {
    if (node.tag === "#text") return handle;
  }
  throw new Error("no text node");
}

function renderedText(dom: FakeDomAdapter): string | undefined {
  return dom.snapshot().children[0]?.children[0]?.children[0]?.text;
}

test("a tree starts the page and later ops update it without recreating nodes", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  assert.equal(session.apply(treePayload(1, "p1", "a")), "tree");
  const handle = textHandle(dom);
  assert.equal(renderedText(dom), "a");

  assert.equal(session.apply(opsPayload(2, "p1", [{ op: "setText", path: [0, 0], text: "b" }])), "ops");
  assert.equal(dom.nodes.get(handle)?.text, "b");
  assert.equal(dom.nodes.has(handle), true, "the text node must be updated in place");
  assert.equal(session.seq(), 2);
  assert.equal(session.pageId(), "p1");
});

test("a stale or duplicate sequence is ignored", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  assert.equal(session.apply(treePayload(2, "p1", "a")), "tree");
  assert.equal(session.apply(treePayload(2, "p1", "b")), "ignored");
  assert.equal(renderedText(dom), "a");
  assert.equal(session.apply(opsPayload(1, "p1", [{ op: "setText", path: [0, 0], text: "c" }])), "ignored");
  assert.equal(renderedText(dom), "a");
});

test("ops before a page tree are rejected, never guessed", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  assert.throws(
    () => session.apply(opsPayload(1, "p1", [{ op: "setText", path: [0, 0], text: "x" }])),
    /before a page tree/,
  );
});

test("ops for a page other than the current tree are rejected", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  session.apply(treePayload(1, "p1", "a"));
  assert.throws(
    () => session.apply(opsPayload(2, "p2", [{ op: "setText", path: [0, 0], text: "x" }])),
    /current tree is p1/,
  );
});

test("a new tree switches the page", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  session.apply(treePayload(1, "p1", "a"));
  assert.equal(session.apply(treePayload(2, "p2", "b")), "tree");
  assert.equal(session.pageId(), "p2");
  assert.equal(renderedText(dom), "b");
});

test("a batch applies in array order", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  session.apply(treePayload(1, "p1", "a"));
  session.apply(
    opsPayload(2, "p1", [
      {
        op: "insert",
        path: [0],
        index: 1,
        node: { type: "element", tag: "wx-text", props: {}, children: [{ type: "text", text: "new" }] },
      },
      { op: "setText", path: [0, 1, 0], text: "changed" },
    ]),
  );
  const children = dom.snapshot().children[0]?.children[0]?.children ?? [];
  assert.equal(children.length, 2);
  assert.equal(children[0].text, "a");
  assert.equal(children[1].children[0].text, "changed");
});

test("a root replace renders the new tree", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  session.apply(treePayload(1, "p1", "a"));
  assert.equal(
    session.apply(opsPayload(2, "p1", [{ op: "replace", path: [], node: pageTree("z") }])),
    "ops",
  );
  assert.equal(renderedText(dom), "z");
});

test("the payload theme is written to the page root", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  session.apply(treePayload(1, "p1", "a", "dark"));
  assert.equal(dom.theme, "dark");
});

test("malformed payloads throw instead of touching the DOM", () => {
  const dom = new FakeDomAdapter();
  const session = createRenderSession(createViewRenderer(dom));
  assert.throws(() => session.apply(null), /invalid render payload/);
  assert.throws(() => session.apply({ pageId: "p1", seq: 0, update: { kind: "tree", tree: pageTree("a"), theme: "light" } }), /invalid render payload/);
  assert.throws(() => session.apply({ pageId: "p1", seq: 1, update: { kind: "ops", ops: [{ op: "nope", path: [] }], theme: "light" } }), /invalid render payload/);
  assert.equal(dom.snapshot().children.length, 0);
});
