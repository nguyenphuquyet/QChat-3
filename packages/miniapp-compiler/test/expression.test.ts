import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateExpression,
  parseExpression,
  stringifyExpressionValue,
} from "../src/index.js";

function parse(source: string) {
  const result = parseExpression(source);
  assert.equal(result.ok, true, result.ok ? "" : result.error.message);
  if (!result.ok) throw new Error("unreachable");
  return result.expression;
}

function evaluate(source: string, scope: Record<string, unknown> = {}): unknown {
  return evaluateExpression(parse(source), scope);
}

function fail(source: string): string {
  const result = parseExpression(source);
  assert.equal(result.ok, false, `expected "${source}" to fail`);
  if (result.ok) throw new Error("unreachable");
  return result.error.message;
}

test("evaluates literals and identifiers", () => {
  assert.equal(evaluate("42"), 42);
  assert.equal(evaluate("4.5"), 4.5);
  assert.equal(evaluate("0x10"), 16);
  assert.equal(evaluate('"hi"'), "hi");
  assert.equal(evaluate("'hi'"), "hi");
  assert.equal(evaluate("true"), true);
  assert.equal(evaluate("false"), false);
  assert.equal(evaluate("null"), null);
  assert.equal(evaluate("undefined"), undefined);
  assert.equal(evaluate("title", { title: "Hello" }), "Hello");
  assert.equal(evaluate("missing", {}), undefined);
});

test("follows operator precedence", () => {
  assert.equal(evaluate("1 + 2 * 3"), 7);
  assert.equal(evaluate("(1 + 2) * 3"), 9);
  assert.equal(evaluate("10 - 4 - 3"), 3);
  assert.equal(evaluate("7 % 4"), 3);
  assert.equal(evaluate("2 + 3 === 5"), true);
  assert.equal(evaluate("1 < 2 && 3 >= 3"), true);
  assert.equal(evaluate("false || 'fallback'"), "fallback");
  assert.equal(evaluate("!false"), true);
  assert.equal(evaluate("-3 + 1"), -2);
});

test("concatenates with + when either side is a string", () => {
  assert.equal(evaluate("'a' + 1"), "a1");
  assert.equal(evaluate("1 + 'a'"), "1a");
  assert.equal(evaluate("name + '!'", { name: "QChat" }), "QChat!");
});

test("supports the ternary operator and short-circuit logic", () => {
  assert.equal(evaluate("count > 0 ? 'yes' : 'no'", { count: 2 }), "yes");
  assert.equal(evaluate("count > 0 ? 'yes' : 'no'", { count: 0 }), "no");
  assert.equal(evaluate("ok && value", { ok: false, value: 9 }), false);
  assert.equal(evaluate("ok || value", { ok: true, value: 9 }), true);
});

test("reads properties, indexes, arrays and objects", () => {
  const scope = {
    user: { name: "An", tags: ["a", "b"] },
    index: 1,
  };
  assert.equal(evaluate("user.name", scope), "An");
  assert.equal(evaluate("user.tags[1]", scope), "b");
  assert.equal(evaluate("user.tags[index]", scope), "b");
  assert.equal(evaluate("user.tags.length", scope), 2);
  assert.equal(evaluate("'abc'.length"), 3);
  assert.deepEqual(evaluate("[1, 2, 3]"), [1, 2, 3]);
  assert.deepEqual(evaluate("{ a: 1, b: 'x' }"), { a: 1, b: "x" });
  assert.deepEqual(evaluate("{ ...base, b: 2 }", { base: { a: 1 } }), { a: 1, b: 2 });
  assert.equal(evaluate("missing.name", {}), undefined);
});

test("never exposes prototype properties", () => {
  assert.equal(evaluate("obj['constructor']", { obj: {} }), undefined);
  assert.equal(evaluate("obj['__proto__'].polluted", { obj: {} }), undefined);
  assert.match(fail("obj.__proto__"), /not allowed/);
  assert.match(fail("{ constructor: 1 }"), /not allowed/);
});

test("rejects executable syntax", () => {
  assert.match(fail("fn()"), /Function calls/);
  assert.match(fail("a.b()"), /Function calls/);
  assert.match(fail("new Date()"), /not supported/);
  assert.match(fail("this.title"), /this/);
  assert.match(fail("function () {}"), /Functions/);
  assert.match(fail("...items"), /Unexpected/);
  assert.match(fail("a?.b"), /Optional chaining/);
});

test("rejects malformed expressions with an offset", () => {
  const incomplete = parseExpression("1 +");
  assert.equal(incomplete.ok, false);
  if (!incomplete.ok) {
    assert.ok(incomplete.error.offset >= 3);
  }
  assert.match(fail("'unterminated"), /not terminated/);
  assert.match(fail("1 2"), /Unexpected/);
  assert.match(fail("(1 + 2"), /Expected/);
});

test("stringifies values for text and attributes", () => {
  assert.equal(stringifyExpressionValue("x"), "x");
  assert.equal(stringifyExpressionValue(3), "3");
  assert.equal(stringifyExpressionValue(false), "false");
  assert.equal(stringifyExpressionValue(null), "");
  assert.equal(stringifyExpressionValue(undefined), "");
  assert.equal(stringifyExpressionValue({ a: 1 }), '{"a":1}');
});
