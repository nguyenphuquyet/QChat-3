import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compileWxss,
  formatDiagnostic,
  type CompiledWxss,
  type WxssCompileOptions,
} from "../src/index.js";

const FILE = "pages/index/index.wxss";
const RPX = "var(--qchat-rpx, calc(100vw / 750))";

function compile(source: string, options: WxssCompileOptions = {}): CompiledWxss {
  const result = compileWxss(source, FILE, options);
  assert.equal(result.ok, true, result.ok ? "" : formatDiagnostic(result.diagnostics[0]));
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

function css(source: string, options: WxssCompileOptions = {}): string {
  return compile(source, options).css;
}

function fail(source: string, code: string, options: WxssCompileOptions = {}) {
  const result = compileWxss(source, FILE, options);
  assert.equal(result.ok, false, `expected ${code} to fail the compile`);
  if (result.ok) throw new Error("unreachable");
  assert.ok(
    result.diagnostics.some((entry) => entry.code === code),
    `expected ${code}, got ${result.diagnostics.map((entry) => entry.code).join(", ")}`,
  );
  return result.diagnostics;
}

test("compiles rules and declarations", () => {
  assert.equal(
    css(`view { color: red; padding: 4px 8px; }
         .card, .panel { border: 1px solid #000; }`),
    "view{color:red;padding:4px 8px}.card, .panel{border:1px solid #000}",
  );
});

test("removes comments", () => {
  assert.equal(css(`/* a */ view { /* b */ color: red; /* c */ }`), "view{color:red}");
});

test("converts rpx to a page-width calc", () => {
  assert.equal(
    css(`.a { width: 20rpx; margin: -4.5rpx; padding: 0rpx; }`),
    `.a{width:calc(20 * ${RPX});margin:calc(-4.5 * ${RPX});padding:0}`,
  );
});

test("does not touch rpx inside strings or url()", () => {
  assert.equal(
    css(`.a { background: url("a20rpx.png"); content: "10rpx"; }`),
    `.a{background:url("a20rpx.png");content:"10rpx"}`,
  );
  assert.equal(
    css(`.a { background: url(icon-20rpx.png); }`),
    `.a{background:url(icon-20rpx.png)}`,
  );
});

test("passes [data-theme] selectors through", () => {
  assert.equal(
    css(`[data-theme="dark"] .card { background: #111; }`),
    `[data-theme="dark"] .card{background:#111}`,
  );
});

test("compiles @media blocks", () => {
  assert.equal(
    css(`@media (min-width: 600px) { .a { width: 10rpx; } }`),
    `@media (min-width: 600px){.a{width:calc(10 * ${RPX})}}`,
  );
});

test("rejects prefers-color-scheme in @media", () => {
  const diagnostics = fail(
    `@media (prefers-color-scheme: dark) { .a { color: white; } }`,
    "WXSS_UNSUPPORTED_FEATURE",
  );
  assert.equal(diagnostics[0].line, 1);
  assert.match(diagnostics[0].message, /data-theme/);
});

test("compiles @keyframes without scoping keyframe selectors", () => {
  assert.equal(
    css(
      `@keyframes spin { from { transform: rotate(0deg); } 50% { opacity: .5; } to { transform: rotate(360deg); } }`,
      { scopeSelector: '[data-wx-component="c"]' },
    ),
    `@keyframes spin{from{transform:rotate(0deg)}50%{opacity:.5}to{transform:rotate(360deg)}}`,
  );
});

test("compiles @font-face", () => {
  assert.equal(
    css(`@font-face { font-family: "X"; src: url("x.woff2"); }`),
    `@font-face{font-family:"X";src:url("x.woff2")}`,
  );
});

test("scopes component selectors and maps :host", () => {
  assert.equal(
    css(`.card, :host .inner { color: red; }`, { scopeSelector: '[data-wx-component="c"]' }),
    `[data-wx-component="c"] .card, [data-wx-component="c"] .inner{color:red}`,
  );
});

test("inlines @import and records the files", () => {
  const files: Record<string, string> = {
    "pages/index/base.wxss": `.base { color: red; }`,
  };
  const compiled = compile(`@import "./base.wxss";\n.a { color: blue; }`, {
    loadFile: (path) => files[path] ?? null,
  });
  assert.equal(compiled.css, `.base{color:red}.a{color:blue}`);
  assert.deepEqual(compiled.files, ["pages/index/base.wxss"]);
});

test("resolves nested @import relative to the imported file", () => {
  const files: Record<string, string> = {
    "pages/index/base.wxss": `@import "../shared/theme.wxss"; .base { color: red; }`,
    "pages/shared/theme.wxss": `:root { --brand: blue; }`,
  };
  const compiled = compile(`@import "./base.wxss";`, {
    loadFile: (path) => files[path] ?? null,
  });
  assert.equal(compiled.css, `:root{--brand:blue}.base{color:red}`);
  assert.deepEqual(compiled.files, ["pages/index/base.wxss", "pages/shared/theme.wxss"]);
});

test("an @import cycle is reported", () => {
  const files: Record<string, string> = {
    "pages/index/a.wxss": `@import "./b.wxss";`,
    "pages/index/b.wxss": `@import "./a.wxss";`,
  };
  const diagnostics = fail(`@import "./a.wxss";`, "WXSS_PARSE_ERROR", {
    loadFile: (path) => files[path] ?? null,
  });
  assert.ok(diagnostics.some((entry) => /cycle/.test(entry.message)));
});

test("a missing or remote @import is reported", () => {
  fail(`@import "./missing.wxss";`, "WXSS_PARSE_ERROR", { loadFile: () => null });
  fail(`@import "https://example.com/a.wxss";`, "WXSS_UNSUPPORTED_FEATURE");
});

test("@import after a rule is reported", () => {
  fail(`.a { color: red; } @import "./base.wxss";`, "WXSS_PARSE_ERROR", {
    loadFile: () => `.b { color: blue; }`,
  });
});

test("an unsupported at-rule is reported, not ignored", () => {
  fail(`@page { margin: 0; }`, "WXSS_UNSUPPORTED_FEATURE");
});

test("malformed stylesheets report a location", () => {
  const unclosed = fail(`.a { color: red;`, "WXSS_PARSE_ERROR");
  assert.equal(unclosed[0].line, 1);
  fail(`.a { color }`, "WXSS_PARSE_ERROR");
  fail(`.a { color: ; }`, "WXSS_PARSE_ERROR");
  fail(`}`, "WXSS_PARSE_ERROR");
  fail(`.a { color: red; } }`, "WXSS_PARSE_ERROR");
});

test("rejects an unsafe @import path", () => {
  fail(`@import "../../../outside.wxss";`, "WXSS_PARSE_ERROR", { loadFile: () => "" });
  fail(`@import "/absolute.wxss";`, "WXSS_PARSE_ERROR", { loadFile: () => "" });
});
