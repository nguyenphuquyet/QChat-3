import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostic, parseWxml, type WxmlElement } from "../src/index.js";

function parse(source: string) {
  const result = parseWxml(source, "pages/index/index.wxml");
  assert.equal(result.ok, true, result.ok ? "" : formatDiagnostic(result.diagnostics[0]));
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

function fail(source: string, code: string) {
  const result = parseWxml(source, "pages/index/index.wxml");
  assert.equal(result.ok, false, `expected ${code} to fail the parse`);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, code, formatDiagnostic(result.diagnostics[0]));
  return result.diagnostics[0];
}

function element(node: unknown): WxmlElement {
  assert.ok(node && typeof node === "object" && (node as WxmlElement).type === "element");
  return node as WxmlElement;
}

function elements(nodes: readonly unknown[]): WxmlElement[] {
  return nodes.filter((node): node is WxmlElement => (node as WxmlElement | null)?.type === "element");
}

test("parses nested elements, attributes and text", () => {
  const document = parse(`<view class="page" data-id="7" hidden>
  <text>{{ title }}</text>
</view>`);

  assert.equal(document.type, "document");
  assert.equal(elements(document.children).length, 1);
  const view = element(elements(document.children)[0]);
  assert.equal(view.tag, "view");
  assert.deepEqual(
    view.attributes.map((attribute) => [attribute.name, attribute.value]),
    [
      ["class", "page"],
      ["data-id", "7"],
      ["hidden", null],
    ],
  );
  const text = element(elements(view.children)[0]);
  assert.equal(text.tag, "text");
  assert.equal((text.children[0] as { text: string }).text, "{{ title }}");
});

test("records the file, line and column of every node", () => {
  const document = parse(`<view>
  <text>hi</text>
</view>`);
  const view = element(elements(document.children)[0]);
  assert.equal(view.loc.file, "pages/index/index.wxml");
  assert.equal(view.loc.line, 1);
  assert.equal(view.loc.column, 1);
  const text = element(elements(view.children)[0]);
  assert.equal(text.loc.line, 2);
  assert.equal(text.loc.column, 3);
});

test("skips comments", () => {
  const document = parse(`<view>
  <!-- a note with <tags> and {{ data }} -->
  <text>after</text>
</view>`);
  const view = element(document.children[0]);
  const elements = view.children.filter((node) => node.type === "element");
  assert.equal(elements.length, 1);
  assert.equal(element(elements[0]).tag, "text");
});

test("supports self-closing elements", () => {
  const document = parse(`<view><image src="{{ url }}" /><input value="a" /></view>`);
  const view = element(document.children[0]);
  const tags = view.children.filter((node) => node.type === "element").map((node) => element(node).tag);
  assert.deepEqual(tags, ["image", "input"]);
  assert.equal(element(view.children[0]).selfClosing, true);
});

test("a mustache expression may contain '<'", () => {
  const document = parse(`<view><text>{{ a < b ? "yes" : "no" }}</text></view>`);
  const view = element(document.children[0]);
  const text = element(view.children[0]);
  assert.equal((text.children[0] as { text: string }).text, `{{ a < b ? "yes" : "no" }}`);
});

test("attributes may hold single quotes, mustaches and empty values", () => {
  const document = parse(`<view class='a' id="" style="color: {{ color }}; width: 10rpx" />`);
  const view = element(document.children[0]);
  assert.deepEqual(
    view.attributes.map((attribute) => attribute.value),
    ["a", "", "color: {{ color }}; width: 10rpx"],
  );
});

test("WXML_INVALID_TAG rejects a tag that does not start with a letter", () => {
  const entry = fail(`<1view />`, "WXML_INVALID_TAG");
  assert.equal(entry.line, 1);
  assert.equal(entry.column, 2);
});

test("WXML_INVALID_ATTRIBUTE rejects an unquoted value", () => {
  const entry = fail(`<view class=page />`, "WXML_INVALID_ATTRIBUTE");
  assert.equal(entry.line, 1);
});

test("WXML_INVALID_ATTRIBUTE rejects a duplicate attribute", () => {
  fail(`<view class="a" class="b" />`, "WXML_INVALID_ATTRIBUTE");
});

test("WXML_UNCLOSED_TAG reports the open element", () => {
  const entry = fail(`<view>\n  <text>hi</text>`, "WXML_UNCLOSED_TAG");
  assert.equal(entry.line, 1);
  assert.equal(entry.column, 1);
});

test("WXML_UNEXPECTED_CLOSE_TAG rejects a stray close tag", () => {
  fail(`<view></view>\n</view>`, "WXML_UNEXPECTED_CLOSE_TAG");
});

test("WXML_UNEXPECTED_CLOSE_TAG rejects a mismatched close tag", () => {
  const entry = fail(`<view>\n</text>`, "WXML_UNEXPECTED_CLOSE_TAG");
  assert.equal(entry.line, 2);
  assert.equal(entry.column, 1);
});

test("WXML_UNTERMINATED_COMMENT reports the comment start", () => {
  const entry = fail(`<view>\n  <!-- no end`, "WXML_UNTERMINATED_COMMENT");
  assert.equal(entry.line, 2);
  assert.equal(entry.column, 3);
});

test("WXML_PARSE_ERROR rejects an unterminated mustache in text", () => {
  fail(`<view><text>{{ a </text></view>`, "WXML_PARSE_ERROR");
});

test("formatDiagnostic renders file:line:column code message", () => {
  const entry = fail(`</view>`, "WXML_UNEXPECTED_CLOSE_TAG");
  assert.equal(
    formatDiagnostic(entry),
    "pages/index/index.wxml:1:1 WXML_UNEXPECTED_CLOSE_TAG Unexpected </view> with no open element.",
  );
});
