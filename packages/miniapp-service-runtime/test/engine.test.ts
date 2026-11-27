import assert from "node:assert/strict";
import { test } from "node:test";
import { createNodeEngine } from "../src/index.js";

test("evaluates a module in an isolated context", () => {
  const engine = createNodeEngine();
  const result = engine.evaluate("var answer = 40 + 2; answer", "app.js");
  assert.equal(result.ok, true);
  assert.equal(result.value, 42);
  assert.equal(engine.kind, "node");
});

test("the script cannot reach host objects", () => {
  const engine = createNodeEngine();
  assert.equal(engine.evaluate("typeof process", "a.js").value, "undefined");
  assert.equal(engine.evaluate("typeof require", "a.js").value, "undefined");
  assert.equal(engine.evaluate("typeof Buffer", "a.js").value, "undefined");
  assert.equal(engine.evaluate("typeof globalThis.__secret", "a.js").value, "undefined");
});

test("dynamic code generation is disabled", () => {
  const engine = createNodeEngine();
  const evaluated = engine.evaluate("eval('1 + 1')", "a.js");
  assert.equal(evaluated.ok, false);
  assert.equal(evaluated.error?.code, "RUNTIME_SCRIPT_ERROR");
  const constructed = engine.evaluate("Function('return 1')()", "a.js");
  assert.equal(constructed.ok, false);
});

test("a runaway script is stopped by the time limit", () => {
  const engine = createNodeEngine({ limits: { timeoutMs: 25 } });
  const result = engine.evaluate("while (true) {}", "loop.js");
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "RUNTIME_CRASH");
});

test("calls a global function installed by the SDK", () => {
  const engine = createNodeEngine();
  engine.evaluate("globalThis.__qchatTest = function (a, b) { return a + b; };", "sdk.js");
  const result = engine.call("__qchatTest", [2, 3]);
  assert.equal(result.ok, true);
  assert.equal(result.value, 5);
});

test("rejects an invalid function name and non-serialisable arguments", () => {
  const engine = createNodeEngine();
  assert.equal(engine.call("process.exit", []).error?.code, "RUNTIME_SCRIPT_ERROR");
  assert.equal(engine.call("a;b", []).error?.code, "RUNTIME_SCRIPT_ERROR");
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(engine.call("x", [circular]).error?.code, "BRIDGE_INVALID_MESSAGE");
});

test("terminate stops the context and refuses later work", () => {
  const engine = createNodeEngine();
  engine.evaluate("var state = 1;", "a.js");
  engine.terminate();
  assert.equal(engine.terminated(), true);
  assert.equal(engine.evaluate("state", "a.js").error?.code, "RUNTIME_CRASH");
});

test("limits can be replaced and are reported", () => {
  const engine = createNodeEngine();
  engine.setLimits({ timeoutMs: 500 });
  assert.equal(engine.limits().timeoutMs, 500);
  assert.equal(engine.memoryUsageBytes(), null);
});
