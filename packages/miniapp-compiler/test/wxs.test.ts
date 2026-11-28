import assert from "node:assert/strict";
import { test } from "node:test";
import type { ElementNode, RenderNode, WxsBundle } from "@qchat/miniapp-contracts";
import {
  buildViewBundle,
  compileWxml,
  formatDiagnostic,
  parseWxs,
  renderWxml,
  reviveWxml,
  type CompileOptions,
  type CompiledWxml,
} from "../src/index.js";
import { WxsError, createWxsRuntime } from "@qchat/miniapp-view-runtime";

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

function textOf(node: RenderNode): string {
  if (node.type === "text") return node.text;
  return node.children.map(textOf).join("");
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

function parse(source: string) {
  const result = parseWxs(source, "m.wxs");
  assert.equal(result.ok, true, result.ok ? "" : formatDiagnostic(result.diagnostics[0]));
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

function parseFail(source: string, code: string) {
  const result = parseWxs(source, "m.wxs");
  assert.equal(result.ok, false, `expected ${code}`);
  if (result.ok) throw new Error("unreachable");
  assert.ok(
    result.diagnostics.some((entry) => entry.code === code),
    `expected ${code}, got ${result.diagnostics.map((entry) => entry.code).join(", ")}`,
  );
}

function bundleFor(name: string, source: string, file = "m.wxs"): WxsBundle {
  const ast = parse(source);
  return {
    modules: { [name]: { name, file, ast } },
    sources: { [file]: ast },
    files: [file],
  };
}

test("parses the documented WXS subset", () => {
  const program = parse(`
    var total = 0;
    function add(a, b) { return a + b; }
    function sum(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] % 2 === 0) continue;
        total += list[i];
      }
      return total;
    }
    module.exports.sum = sum;
    module.exports.add = add;
  `);
  assert.equal(program.type, "program");
  assert.ok(program.body.some((statement) => statement.type === "function"));
});

test("rejects unsupported WXS syntax with a diagnostic", () => {
  parseFail("let x = 1;", "WXS_UNSUPPORTED_FEATURE");
  parseFail("const x = 1;", "WXS_UNSUPPORTED_FEATURE");
  parseFail("var f = () => 1;", "WXS_UNSUPPORTED_FEATURE");
  parseFail("var d = new Date();", "WXS_UNSUPPORTED_FEATURE");
  parseFail("var s = `x`;", "WXS_UNSUPPORTED_FEATURE");
  parseFail("var r = /a/;", "WXS_UNSUPPORTED_FEATURE");
  parseFail("switch (1) { case 1: break; }", "WXS_UNSUPPORTED_FEATURE");
  parseFail("function f() { return this; }", "WXS_UNSUPPORTED_FEATURE");
  parseFail("return 1;", "WXS_PARSE_ERROR");
  parseFail("break;", "WXS_PARSE_ERROR");
});

test("a WXS function can be called from a WXML expression", () => {
  const tree = render(
    `<wxs module="fmt">
      function upper(value) { return value.toUpperCase(); }
      module.exports.upper = upper;
    </wxs>
    <text>{{ fmt.upper(name) }}</text>`,
    { name: "qchat" },
  );
  assert.equal(textOf(tree), "QCHAT");
});

test("a src module can require another WXS file", () => {
  const files: Record<string, string> = {
    "pages/index/m.wxs": `var util = require("./util.wxs");
      module.exports.add = function (a, b) { return util.inc(a) + b; };`,
    "pages/index/util.wxs": `module.exports.inc = function (value) { return value + 1; };`,
  };
  const tree = render(
    `<wxs module="m" src="./m.wxs"></wxs>
     <text>{{ m.add(1, 2) }}</text>`,
    {},
    { loadFile: (path) => files[path] ?? null },
  );
  assert.equal(textOf(tree), "4");
});

test("a WXS handler is compiled into the event binding", () => {
  const tree = render(
    `<wxs module="m">
      function tap(event) { return event; }
      module.exports.tap = tap;
    </wxs>
    <button bindtap="wxs:m.tap">Go</button>`,
  );
  const button = tree as ElementNode;
  assert.equal(button.tag, "wx-button");
  assert.equal(button.events?.tap.handler, "wxs:m.tap");
});

test("an unknown WXS module is a compile error", () => {
  fail(`<text>{{ missing.fn() }}</text>`, "WXML_INVALID_EXPRESSION");
  fail(`<button bindtap="wxs:missing.tap">Go</button>`, "WXML_INVALID_EVENT");
});

test("a duplicate module and an inline element are rejected", () => {
  fail(
    `<wxs module="m">module.exports.a = function () {};</wxs><wxs module="m">module.exports.b = function () {};</wxs>`,
    "WXS_PARSE_ERROR",
  );
  fail(
    `<wxs module="m"><view>not code</view></wxs>`,
    "WXS_PARSE_ERROR",
  );
  fail(
    `<view><wxs module="m">module.exports.a = function () {};</wxs></view>`,
    "WXS_PARSE_ERROR",
  );
});

test("a component cannot declare WXS", () => {
  fail(
    `<wxs module="m">module.exports.a = function () {};</wxs>`,
    "WXS_UNSUPPORTED",
    { allowWxs: false },
  );
});

test("the interpreter evaluates arrays, objects, closures and JSON", () => {
  const runtime = createWxsRuntime(bundleFor("m", `
    function make(base) {
      return function (value) { return base + value; };
    }
    module.exports.run = function (list) {
      var add = make(10);
      var doubled = list.map(function (item) { return add(item); });
      return { doubled: doubled, json: JSON.stringify(doubled), first: doubled[0] };
    };
  `));
  const result = runtime.call("m.run", [[1, 2, 3]]) as { doubled: number[]; json: string; first: number };
  assert.deepEqual(result.doubled, [11, 12, 13]);
  assert.equal(result.json, "[11,12,13]");
  assert.equal(result.first, 11);
});

test("the interpreter owns its values and blocks prototype access", () => {
  const runtime = createWxsRuntime(bundleFor("m", `
    module.exports.read = function (value) { return value.name; };
    module.exports.proto = function (value) { return value["__proto__"]; };
    module.exports.global = function () { return typeof name; };
  `));
  const input = { name: "qchat" };
  assert.equal(runtime.call("m.read", [input]), "qchat");
  assert.equal(runtime.call("m.global", []), "undefined");
  input.name = "changed";
  assert.equal(runtime.call("m.read", [input]), "changed");
  assert.throws(
    () => runtime.call("m.proto", [{}]),
    (error: unknown) => error instanceof WxsError && error.code === "WXS_UNSAFE_ACCESS",
  );
});

test("a literal __proto__ is rejected at compile time", () => {
  parseFail("var value = { __proto__: 1 };", "WXS_UNSAFE_ACCESS");
  parseFail("var value = {}; value.__proto__;", "WXS_UNSAFE_ACCESS");
});

test("a runaway loop and runaway recursion hit the runtime limits", () => {
  const loop = createWxsRuntime(bundleFor("loop", `module.exports.run = function () { while (true) {} };`), {
    stepBudget: 1_000,
  });
  assert.throws(
    () => loop.call("loop.run", []),
    (error: unknown) => error instanceof WxsError && error.code === "WXS_LIMIT_EXCEEDED",
  );

  const recurse = createWxsRuntime(bundleFor("rec", `function f() { return f(); } module.exports.run = f;`));
  assert.throws(
    () => recurse.call("rec.run", []),
    (error: unknown) => error instanceof WxsError && error.code === "WXS_LIMIT_EXCEEDED",
  );
});

test("console.log goes to the supplied sink", () => {
  const messages: string[] = [];
  const runtime = createWxsRuntime(bundleFor("m", `module.exports.run = function () { console.log("hello", 2); };`), {
    log: (message) => messages.push(message),
  });
  runtime.call("m.run", []);
  assert.deepEqual(messages, ["hello 2"]);
});

test("ownerInstance.callMethod reaches the page", () => {
  const calls: { name: string; data: unknown }[] = [];
  const runtime = createWxsRuntime(bundleFor("m", `
    module.exports.tap = function (event, owner) {
      owner.callMethod("onTap", { value: event.detail.value });
    };
  `));
  runtime.callEvent("m.tap", { detail: { value: 7 } }, {
    callMethod: (name, data) => calls.push({ name, data }),
  });
  assert.deepEqual(calls, [{ name: "onTap", data: { value: 7 } }]);
});

test("getRegExp and Math are available; the host is not", () => {
  const runtime = createWxsRuntime(bundleFor("m", `
    module.exports.run = function (text) {
      var pattern = getRegExp("^q", "i");
      return { match: pattern.test(text), root: Math.max(1, 9, 4), host: typeof process };
    };
  `));
  assert.deepEqual(runtime.call("m.run", ["QChat"]), { match: true, root: 9, host: "undefined" });
});

test("a compiled page bundle keeps WXS through JSON and revive", () => {
  const files: Record<string, string> = {
    "app.json": JSON.stringify({ pages: ["pages/index/index"] }),
    "app.js": "App({})",
    "pages/index/index.js": "Page({})",
    "pages/index/index.wxml": `<wxs module="m">module.exports.upper = function (value) { return value.toUpperCase(); };</wxs><text>{{ m.upper(name) }}</text>`,
  };
  const built = buildViewBundle((path) => files[path] ?? null);
  assert.equal(built.ok, true, built.ok ? "" : formatDiagnostic(built.diagnostics[0]));
  if (!built.ok) throw new Error("unreachable");

  const serialized = JSON.parse(JSON.stringify(built.value.bundle)) as {
    pages: Record<string, { wxml: Parameters<typeof reviveWxml>[0] }>;
  };
  assert.ok(serialized.pages["pages/index/index"].wxml.wxs);
  const revived = reviveWxml(serialized.pages["pages/index/index"].wxml);
  const result = renderWxml(revived, { name: "qchat" });
  assert.equal(result.ok, true, result.ok ? "" : formatDiagnostic(result.diagnostics[0]));
  if (result.ok) assert.equal(textOf(result.value), "QCHAT");
});

test("a malformed serialized WXS bundle is rejected", () => {
  assert.throws(
    () => reviveWxml({
      file: "pages/index/index.wxml",
      nodes: [],
      templates: {},
      componentTags: {},
      files: [],
      wxs: { modules: {}, sources: {}, files: [1] } as unknown as WxsBundle,
    }),
    /malformed WXS bundle/,
  );
});
