import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canReuseRenderNode,
  diffRenderTree,
  validateRenderOp,
  validateRenderOps,
  validateRenderPayload,
  type ElementNode,
  type RenderNode,
  type TextNode,
} from "../src/index.js";

function view(children: RenderNode[], props: Record<string, string | number | boolean> = {}): ElementNode {
  return { type: "element", tag: "wx-view", props, children };
}

function text(value: string): TextNode {
  return { type: "text", text: value };
}

test("identical trees produce no operations", () => {
  const tree = view([text("a"), { type: "element", tag: "wx-button", props: { type: "primary" }, children: [text("go")] }]);
  assert.deepEqual(diffRenderTree(tree, structuredClone(tree)), []);
});

test("a text change is a path-based setText", () => {
  assert.deepEqual(diffRenderTree(view([text("a")]), view([text("b")])), [
    { op: "setText", path: [0], text: "b" },
  ]);
});

test("property changes are setProp and removeProp, and false removes", () => {
  assert.deepEqual(diffRenderTree(view([], { class: "a" }), view([], { class: "a", hidden: true })), [
    { op: "setProp", path: [], name: "hidden", value: true },
  ]);
  assert.deepEqual(diffRenderTree(view([], { class: "a", hidden: true }), view([], { class: "a", hidden: false })), [
    { op: "removeProp", path: [], name: "hidden" },
  ]);
  assert.deepEqual(diffRenderTree(view([], { class: "a" }), view([], {})), [
    { op: "removeProp", path: [], name: "class" },
  ]);
});

test("dataset and event changes keep the node identity", () => {
  const previous: ElementNode = {
    type: "element",
    tag: "wx-button",
    props: {},
    dataset: { action: "one" },
    events: { tap: { handler: "onTap" } },
    children: [],
  };
  const next: ElementNode = {
    type: "element",
    tag: "wx-button",
    props: {},
    dataset: { action: "two" },
    events: { tap: { handler: "onTap", catch: true } },
    children: [],
  };
  assert.deepEqual(diffRenderTree(previous, next), [
    { op: "setDataset", path: [], dataset: { action: "two" } },
    { op: "setEvents", path: [], events: { tap: { handler: "onTap", catch: true } } },
  ]);
  const cleared = { ...next, dataset: undefined, events: undefined };
  assert.deepEqual(diffRenderTree(next, cleared), [
    { op: "setDataset", path: [], dataset: {} },
    { op: "setEvents", path: [], events: {} },
  ]);
});

test("children are updated in order, then inserted ascending, then removed descending", () => {
  assert.deepEqual(diffRenderTree(view([text("a"), text("b")]), view([text("A"), text("c"), text("d")])), [
    { op: "setText", path: [0], text: "A" },
    { op: "setText", path: [1], text: "c" },
    { op: "insert", path: [], index: 2, node: text("d") },
  ]);
  assert.deepEqual(diffRenderTree(view([text("a"), text("b"), text("c"), text("d")]), view([text("A"), text("c")])), [
    { op: "setText", path: [0], text: "A" },
    { op: "setText", path: [1], text: "c" },
    { op: "remove", path: [], index: 3 },
    { op: "remove", path: [], index: 2 },
  ]);
});

test("a changed tag or key replaces the node and stops descending", () => {
  const button: ElementNode = { type: "element", tag: "wx-button", props: {}, children: [text("a")] };
  const other: ElementNode = { type: "element", tag: "wx-image", props: {}, children: [text("b")] };
  assert.deepEqual(diffRenderTree(view([button]), view([other])), [
    { op: "replace", path: [0], node: other },
  ]);
  const keyed: ElementNode = { type: "element", tag: "wx-view", key: "a", props: {}, children: [text("a")] };
  const rekeyed: ElementNode = { type: "element", tag: "wx-view", key: "b", props: {}, children: [text("b")] };
  assert.deepEqual(diffRenderTree(view([keyed]), view([rekeyed])), [
    { op: "replace", path: [0], node: rekeyed },
  ]);
});

test("a root change is a replace at the empty path", () => {
  assert.deepEqual(diffRenderTree(view([]), text("x")), [{ op: "replace", path: [], node: text("x") }]);
  assert.equal(canReuseRenderNode(view([]), text("x")), false);
  assert.equal(canReuseRenderNode(view([]), view([])), true);
  assert.equal(canReuseRenderNode(text("a"), text("b")), true);
});

test("render ops are validated before they reach the DOM", () => {
  const tree = view([text("a")]);
  const valid = diffRenderTree(view([text("b")]), tree);
  assert.equal(validateRenderOps(valid), true);
  assert.equal(validateRenderOp({ op: "setText", path: [0], text: "x" }), true);
  assert.equal(validateRenderOp({ op: "setProp", path: [], name: "class", value: true }), true);
  assert.equal(validateRenderOp({ op: "setDataset", path: [], dataset: { action: "x" } }), true);
  assert.equal(validateRenderOp({ op: "setEvents", path: [], events: { tap: { handler: "onTap" } } }), true);
  assert.equal(validateRenderOp({ op: "insert", path: [], index: 0, node: text("x") }), true);
  assert.equal(validateRenderOp({ op: "remove", path: [], index: 0 }), true);
  assert.equal(validateRenderOp({ op: "replace", path: [], node: tree }), true);

  assert.equal(validateRenderOp({ op: "setText", path: [-1], text: "x" }), false);
  assert.equal(validateRenderOp({ op: "setText", path: [0.5], text: "x" }), false);
  assert.equal(validateRenderOp({ op: "setText", path: ["0"], text: "x" }), false);
  assert.equal(validateRenderOp({ op: "setText", path: [], text: 1 }), false);
  assert.equal(validateRenderOp({ op: "nope", path: [] }), false);
  assert.equal(validateRenderOp({ op: "insert", path: [], index: 0 }), false);
  assert.equal(validateRenderOp({ op: "setDataset", path: [], dataset: { action: 1 } }), false);
  assert.equal(validateRenderOp({ op: "setEvents", path: [], events: { tap: {} } }), false);
  assert.equal(validateRenderOps([{ op: "nope", path: [] }]), false);
  assert.equal(validateRenderOps("no"), false);
});

test("render payloads carry a page, a sequence and one validated update", () => {
  const tree = view([text("a")]);
  assert.equal(validateRenderPayload({ pageId: "p1", seq: 1, update: { kind: "tree", tree, theme: "light" } }), true);
  assert.equal(
    validateRenderPayload({
      pageId: "p1",
      seq: 2,
      update: { kind: "ops", ops: [{ op: "setText", path: [0], text: "b" }], theme: "dark" },
    }),
    true,
  );
  assert.equal(validateRenderPayload({ pageId: "p1", seq: 0, update: { kind: "tree", tree, theme: "light" } }), false);
  assert.equal(validateRenderPayload({ pageId: "x", seq: 1, update: { kind: "tree", tree, theme: "light" } }), false);
  assert.equal(validateRenderPayload({ pageId: "p1", seq: 1, update: { kind: "tree", tree, theme: "auto" } }), false);
  assert.equal(validateRenderPayload({ pageId: "p1", seq: 1, update: { kind: "ops", ops: [], theme: "light" } }), true);
  assert.equal(validateRenderPayload({ pageId: "p1", seq: 1, update: { kind: "nope", theme: "light" } }), false);
  assert.equal(validateRenderPayload(null), false);
});
