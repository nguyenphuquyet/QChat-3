import assert from "node:assert/strict";
import { test } from "node:test";
import type { ElementNode, RenderNode } from "@qchat/miniapp-contracts";
import {
  compileWxml,
  formatDiagnostic,
  renderWxml,
  type CompileOptions,
  type CompiledWxml,
} from "../src/index.js";

const FILE = "pages/index/index.wxml";

function compile(source: string, options: CompileOptions = {}): CompiledWxml {
  const result = compileWxml(source, FILE, options);
  assert.equal(result.ok, true, result.ok ? "" : formatDiagnostic(result.diagnostics[0]));
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

function render(source: string, data: Record<string, unknown> = {}, options: CompileOptions = {}): RenderNode {
  const result = renderWxml(compile(source, options), data);
  assert.equal(result.ok, true, result.ok ? "" : formatDiagnostic(result.diagnostics[0]));
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

function renderWithDiagnostics(source: string, data: Record<string, unknown> = {}) {
  const result = renderWxml(compile(source), data);
  assert.equal(result.ok, true);
  return result;
}

function fail(source: string, code: string, options: CompileOptions = {}) {
  const result = compileWxml(source, FILE, options);
  assert.equal(result.ok, false, `expected ${code} to fail the compile`);
  if (result.ok) throw new Error("unreachable");
  assert.ok(
    result.diagnostics.some((entry) => entry.code === code),
    `expected ${code}, got ${result.diagnostics.map((entry) => entry.code).join(", ")}`,
  );
  return result.diagnostics;
}

function element(node: RenderNode): ElementNode {
  assert.equal(node.type, "element");
  return node as ElementNode;
}

function textOf(node: RenderNode): string {
  assert.equal(node.type, "text");
  return (node as { text: string }).text;
}

test("renders interpolation in text and attributes", () => {
  const tree = element(render(
    `<view class="page {{ theme }}" data-id="{{ id }}" hidden="{{ visible }}">
      <text>{{ title }} ({{ count + 1 }})</text>
    </view>`,
    { theme: "dark", id: 7, visible: false, title: "Hi", count: 2 },
  ));
  assert.equal(tree.tag, "wx-view");
  assert.equal(tree.props.class, "page dark");
  assert.equal(tree.props.hidden, false);
  assert.deepEqual(tree.dataset, { id: "7" });
  assert.equal(tree.children.length, 1);
  assert.equal(textOf(element(tree.children[0]).children[0]), "Hi (3)");
});

test("keeps a whole-mustache value typed and a mixed value a string", () => {
  const tree = element(render(
    `<button disabled="{{ off }}" loading data-count="{{ n }}" class="a {{ kind }} c">Go</button>`,
    { off: false, n: 2, kind: "b" },
  ));
  assert.equal(tree.tag, "wx-button");
  assert.equal(tree.props.disabled, false);
  assert.equal(tree.props.loading, true);
  assert.equal(tree.props.class, "a b c");
  assert.deepEqual(tree.dataset, { count: "2" });
});

test("renders wx:if, wx:elif and wx:else", () => {
  const source = `<view wx:if="{{ n === 1 }}">one</view>
    <view wx:elif="{{ n === 2 }}">two</view>
    <view wx:else>other</view>`;
  assert.equal(textOf(element(render(source, { n: 1 })).children[0]), "one");
  assert.equal(textOf(element(render(source, { n: 2 })).children[0]), "two");
  assert.equal(textOf(element(render(source, { n: 3 })).children[0]), "other");
});

test("renders wx:for with a key, item name and index name", () => {
  const tree = element(render(
    `<view wx:for="{{ items }}" wx:key="id" wx:for-item="entry" wx:for-index="i">
      <text>{{ i }}:{{ entry.name }}</text>
    </view>`,
    { items: [{ id: "a", name: "A" }, { id: "b", name: "B" }] },
  ));
  assert.equal(tree.tag, "wx-view");
  assert.equal(tree.props.class, "wx-page");
  assert.equal(tree.children.length, 2);
  const [first, second] = tree.children.map(element);
  assert.equal(first.key, "a");
  assert.equal(second.key, "b");
  assert.equal(textOf(element(first.children[0]).children[0]), "0:A");
  assert.equal(textOf(element(second.children[0]).children[0]), "1:B");
});

test("wx:key=*this keys primitive items", () => {
  const tree = element(render(
    `<text wx:for="{{ tags }}" wx:key="*this">{{ item }}</text>`,
    { tags: ["a", "b"] },
  ));
  assert.deepEqual(tree.children.map(element).map((child) => child.key), ["a", "b"]);
});

test("block renders its children without an element", () => {
  const tree = element(render(
    `<block wx:if="{{ ok }}"><text>a</text><text>b</text></block>`,
    { ok: true },
  ));
  assert.equal(tree.props.class, "wx-page");
  assert.deepEqual(tree.children.map(element).map((child) => child.tag), ["wx-text", "wx-text"]);
});

test("template definition and call with data", () => {
  const tree = element(render(
    `<template name="row"><text class="row">{{ label }}</text></template>
     <template is="row" data="{{ label: title }}" />`,
    { title: "Hi" },
  ));
  assert.equal(tree.tag, "wx-text");
  assert.equal(tree.props.class, "row");
  assert.equal(textOf(tree.children[0]), "Hi");
});

test("template name may be an expression", () => {
  const tree = element(render(
    `<template name="row"><text>{{ label }}</text></template>
     <template is="{{ which }}" data="{{ label: title }}" />`,
    { which: "row", title: "Hi" },
  ));
  assert.equal(textOf(tree.children[0]), "Hi");
});

test("import brings in template definitions", () => {
  const files: Record<string, string> = {
    "pages/index/row.wxml": `<template name="row"><text>{{ label }}</text></template>`,
  };
  const compiled = compile(
    `<import src="./row.wxml" /><template is="row" data="{{ label: 'x' }}" />`,
    { loadFile: (path) => files[path] ?? null },
  );
  assert.deepEqual(compiled.files, ["pages/index/row.wxml"]);
  const rendered = renderWxml(compiled, {});
  assert.equal(rendered.ok, true);
  if (!rendered.ok) return;
  assert.equal(textOf(element(rendered.value).children[0]), "x");
});

test("include splices the included nodes", () => {
  const files: Record<string, string> = {
    "pages/index/part.wxml": `<view class="part">hi</view>`,
  };
  const tree = element(render(
    `<include src="./part.wxml" />`,
    {},
    { loadFile: (path) => files[path] ?? null },
  ));
  assert.equal(tree.tag, "wx-view");
  assert.equal(tree.props.class, "part");
  assert.equal(textOf(tree.children[0]), "hi");
});

test("compiles bind and catch events with dataset", () => {
  const tree = element(render(
    `<view bindtap="{{ handlerName }}" catchlongpress="onLong" bind:touchstart="onTouch"
           data-kind="row" data-user-id="{{ user.id }}">x</view>`,
    { handlerName: "onTap", user: { id: 9 } },
  ));
  assert.deepEqual(tree.events, {
    tap: { handler: "onTap" },
    longpress: { handler: "onLong", catch: true },
    touchstart: { handler: "onTouch" },
  });
  assert.deepEqual(tree.dataset, { kind: "row", userId: "9" });
});

test("slot compiles to a wx-slot element", () => {
  const tree = element(render(`<slot name="head" />`));
  assert.equal(tree.tag, "wx-slot");
  assert.equal(tree.props.name, "head");
});

test("multiple roots are wrapped in a page view", () => {
  const tree = element(render(`<text>a</text><text>b</text>`));
  assert.equal(tree.tag, "wx-view");
  assert.equal(tree.props.class, "wx-page");
  assert.equal(tree.children.length, 2);
});

test("formatting whitespace between elements is dropped", () => {
  const tree = element(render(`<view>
    <text>a</text>
  </view>`));
  assert.equal(tree.children.length, 1);
});

test("unknown components and invalid attributes are reported", () => {
  fail(`<foo />`, "WXML_UNKNOWN_COMPONENT");
  fail(`<view foo="1" />`, "WXML_INVALID_ATTRIBUTE");
  fail(`<image src="x" mode="aspectFill" wrong="1" />`, "WXML_INVALID_ATTRIBUTE");
});

test("unsupported directives are reported, never ignored", () => {
  fail(`<input model:value="{{ text }}" />`, "COMPILER_UNSUPPORTED_DIRECTIVE");
  fail(`<view capture-bind:tap="onTap" />`, "COMPILER_UNSUPPORTED_DIRECTIVE");
  fail(`<wxs module="m">module.exports = 1</wxs>`, "WXS_UNSUPPORTED");
});

test("misplaced conditional and loop directives are reported", () => {
  fail(`<view wx:elif="{{ x }}" />`, "WXML_INVALID_DIRECTIVE");
  fail(`<view wx:else />`, "WXML_INVALID_DIRECTIVE");
  fail(`<view wx:key="id" />`, "WXML_INVALID_DIRECTIVE");
  fail(`<view wx:for="{{ list }}" wx:for-item="x" wx:key="a b" />`, "WXML_INVALID_DIRECTIVE");
});

test("an invalid expression is a compile error with a location", () => {
  const diagnostics = fail(`<view>\n  <text>{{ a + }}</text>\n</view>`, "WXML_INVALID_EXPRESSION");
  assert.equal(diagnostics[0].line, 2);
  assert.equal(diagnostics[0].file, FILE);
});

test("a non-array wx:for renders nothing and warns", () => {
  const result = renderWithDiagnostics(`<view wx:for="{{ n }}"><text>{{ item }}</text></view>`, { n: 5 });
  assert.equal(result.ok, true);
  assert.ok(result.diagnostics.some((entry) => entry.code === "WXML_RENDER_WARNING"));
  const tree = element(result.value);
  assert.equal(tree.children.length, 0);
});

test("a missing template is a render error", () => {
  const compiled = compile(`<template is="{{ name }}" />`);
  const result = renderWxml(compiled, { name: "missing" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics[0].code, "WXML_INVALID_ATTRIBUTE");
});

test("P0 components map to their wx-* web component tags", () => {
  const tree = element(render(
    `<view><text>t</text><image src="x" /><button>go</button><input value="v" /><scroll-view scroll-y /></view>`,
  ));
  const tags = tree.children.map(element).map((child) => child.tag);
  assert.deepEqual(tags, ["wx-text", "wx-image", "wx-button", "wx-input", "wx-scroll-view"]);
});
