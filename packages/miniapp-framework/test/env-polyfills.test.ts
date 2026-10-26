import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { bundleEntry } from "../src/compiler.js";
import {
  createAbortError,
  QappAbortController,
  QappAbortSignal,
} from "../src/env/abort.js";
import {
  QappDataCloneError,
  structuredCloneValue,
} from "../src/env/clone.js";
import { createConsole, formatConsoleArgs, MAX_LOG_LENGTH } from "../src/env/console.js";
import { QappTextDecoder, QappTextEncoder } from "../src/env/encoding.js";
import {
  installIntl,
  QappDateTimeFormat,
  QappNumberFormat,
  supportedLocales,
} from "../src/env/intl.js";
import { QappURL, QappURLSearchParams } from "../src/env/url.js";
import { runBundle, type HarnessResult } from "../src/tester.js";

const fixtures = path.join(import.meta.dirname, "fixtures");
const UTC = { timeZone: "UTC" } as const;
const INSTANT = new Date(Date.UTC(2026, 9, 26, 14, 5, 9));

test("structuredClone copies data, keeps cycles and refuses functions", () => {
  const source = {
    list: [1, 2, 3],
    nested: { ok: true },
    when: new Date("2026-10-26T00:00:00.000Z"),
    pattern: /a+b/gi,
    map: new Map<string, number>([["a", 1]]),
    set: new Set([1, 2]),
  };
  const copy = structuredCloneValue(source);
  assert.notEqual(copy, source);
  assert.deepEqual(copy, source);
  assert.notEqual(copy.nested, source.nested);
  assert.equal(copy.when.getTime(), source.when.getTime());
  assert.equal(copy.pattern.source, "a+b");
  assert.equal(copy.map.get("a"), 1);
  assert.equal(copy.set.has(2), true);

  const cycle: Record<string, unknown> = { name: "loop" };
  cycle.self = cycle;
  const clonedCycle = structuredCloneValue(cycle);
  assert.equal(clonedCycle.self, clonedCycle);

  const bytes = structuredCloneValue(new Uint8Array([1, 2, 3]));
  assert.deepEqual(Array.from(bytes), [1, 2, 3]);

  assert.throws(() => structuredCloneValue(() => 1), QappDataCloneError);
  assert.throws(() => structuredCloneValue(Symbol("x")), QappDataCloneError);
  assert.throws(() => structuredCloneValue(new (class Point {})()), QappDataCloneError);
  assert.equal(structuredCloneValue(3), 3);
  assert.equal(structuredCloneValue(null), null);
});

test("URL parses, rebuilds and resolves relative references", () => {
  const url = new QappURL("https://user:pass@qchat.vn:8443/a/b?x=1#top");
  assert.equal(url.protocol, "https:");
  assert.equal(url.username, "user");
  assert.equal(url.password, "pass");
  assert.equal(url.hostname, "qchat.vn");
  assert.equal(url.port, "8443");
  assert.equal(url.host, "qchat.vn:8443");
  assert.equal(url.pathname, "/a/b");
  assert.equal(url.search, "?x=1");
  assert.equal(url.hash, "#top");
  assert.equal(url.origin, "https://qchat.vn:8443");
  assert.equal(String(url), "https://user:pass@qchat.vn:8443/a/b?x=1#top");

  assert.equal(String(new QappURL("/x/y", "https://qchat.vn/base/z")), "https://qchat.vn/x/y");
  assert.equal(
    String(new QappURL("../up", "https://qchat.vn/a/b/c?q=1")),
    "https://qchat.vn/a/up",
  );
  assert.equal(String(new QappURL("?page=2", "https://qchat.vn/a")), "https://qchat.vn/a?page=2");
  assert.equal(String(new QappURL("#frag", "https://qchat.vn/a")), "https://qchat.vn/a#frag");
  assert.equal(String(new QappURL("//cdn.qchat.vn/x", "https://qchat.vn/a")), "https://cdn.qchat.vn/x");
  assert.throws(() => new QappURL("/relative"));

  const path = new QappURL("https://qchat.vn/a/./b/../c/");
  assert.equal(path.pathname, "/a/c/");
});

test("URLSearchParams keeps the URL in sync and follows the specked set order", () => {
  const params = new QappURLSearchParams("?a=1&b=2&a=3");
  assert.equal(params.get("a"), "1");
  assert.deepEqual(params.getAll("a"), ["1", "3"]);
  assert.equal(params.has("b"), true);
  assert.equal(params.has("a", "3"), true);
  assert.equal(params.size, 3);
  params.append("c", "x y");
  assert.equal(params.toString(), "a=1&b=2&a=3&c=x+y");
  params.set("a", "9");
  assert.equal(
    params.toString(),
    "a=9&b=2&c=x+y",
    "set replaces the first pair in place and drops the duplicates",
  );
  params.sort();
  assert.deepEqual(params.keys(), ["a", "b", "c"]);
  params.delete("c");
  assert.equal(params.has("c"), false);

  const url = new QappURL("https://qchat.vn/search?page=1");
  url.searchParams.append("q", "xin chào");
  assert.equal(url.search, "?page=1&q=xin+ch%C3%A0o");
  assert.equal(String(url), "https://qchat.vn/search?page=1&q=xin+ch%C3%A0o");
  url.search = "?only=1";
  assert.deepEqual(url.searchParams.entries(), [["only", "1"]]);
  url.searchParams.delete("only");
  assert.equal(url.search, "");

  assert.deepEqual(Array.from(new QappURLSearchParams({ a: 1, b: "two" }).entries()), [
    ["a", "1"],
    ["b", "two"],
  ]);
  assert.deepEqual(Array.from(new QappURLSearchParams([["a", 1]]).entries()), [["a", "1"]]);
  assert.throws(() => new QappURLSearchParams([["a"]] as unknown as Array<[string, string]>));
});

test("TextEncoder and TextDecoder round-trip UTF-8 and reject other labels", () => {
  const encoder = new QappTextEncoder();
  assert.deepEqual(Array.from(encoder.encode("A")), [65]);
  assert.deepEqual(Array.from(encoder.encode("é")), [0xc3, 0xa9]);
  assert.deepEqual(Array.from(encoder.encode("☕")), [0xe2, 0x98, 0x95]);
  assert.deepEqual(Array.from(encoder.encode("😀")), [0xf0, 0x9f, 0x98, 0x80]);
  // A lone surrogate becomes the replacement character.
  assert.deepEqual(Array.from(encoder.encode("\ud800")), [0xef, 0xbf, 0xbd]);

  const decoder = new QappTextDecoder();
  assert.equal(decoder.decode(new Uint8Array([0x51, 0x43])), "QC");
  assert.equal(decoder.decode(new Uint8Array([0xf0, 0x9f, 0x98, 0x80])), "😀");
  assert.equal(decoder.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])), "A", "BOM is skipped");
  assert.equal(
    decoder.decode(new Uint8Array([0xff, 0x41])),
    "\ufffdA",
    "invalid bytes become U+FFFD",
  );
  assert.throws(() => new QappTextDecoder("latin1"), RangeError);
  assert.throws(
    () => new QappTextDecoder("utf-8", { fatal: true }).decode(new Uint8Array([0xff])),
    TypeError,
  );
  assert.equal(
    new QappTextDecoder("utf-8", { ignoreBOM: true }).decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])),
    "\ufeffA",
  );
});

test("AbortController signals abort once and carry the reason", async () => {
  const controller = new QappAbortController();
  const events: string[] = [];
  controller.signal.addEventListener("abort", () => events.push("listener"));
  controller.signal.onabort = () => events.push("onabort");
  assert.equal(controller.signal.aborted, false);
  controller.signal.throwIfAborted();
  controller.abort("because");
  assert.equal(controller.signal.aborted, true);
  assert.equal(controller.signal.reason, "because");
  assert.deepEqual(events, ["onabort", "listener"]);
  controller.abort("again");
  assert.deepEqual(events, ["onabort", "listener"], "aborting twice notifies once");
  assert.throws(() => controller.signal.throwIfAborted(), (error: Error) => {
    assert.equal(error.name, "AbortError");
    return true;
  });

  const preset = QappAbortSignal.abort("nope");
  assert.equal(preset.aborted, true);
  assert.equal(preset.reason, "nope");
  assert.equal(createAbortError().name, "AbortError");

  // `AbortSignal.timeout` uses whatever `setTimeout` is installed.
  const timed = QappAbortSignal.timeout(5);
  assert.equal(timed.aborted, false);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(timed.aborted, true);
  assert.equal((timed.reason as Error).name, "AbortError");
});

test("the console formats values and truncates huge lines", () => {
  const entries: Array<{ level: string; message: string; stack?: string }> = [];
  const sink = createConsole((entry) => entries.push(entry));
  sink.log("hello", 1, true, null);
  sink.warn("careful");
  sink.error(new Error("boom"));
  sink.debug("detail");
  assert.deepEqual(
    entries.map((entry) => [entry.level, entry.message]),
    [
      ["info", "hello 1 true null"],
      ["warn", "careful"],
      ["error", "Error: boom"],
      ["debug", "detail"],
    ],
  );
  assert.ok(entries[2].stack?.includes("boom"));

  const long = formatConsoleArgs(["x".repeat(MAX_LOG_LENGTH + 50)]);
  assert.ok(long.message.length < MAX_LOG_LENGTH + 60);
  assert.ok(long.message.includes("more characters"));
  assert.equal(formatConsoleArgs([{ a: [1, { b: 2 }] }]).message, "{ a: [1, { b: 2 }] }");
});

test("Intl NumberFormat covers vi-VN and en-US numbers, percents, currencies", () => {
  assert.deepEqual(supportedLocales(), ["vi-VN", "en-US"]);
  const vi = new QappNumberFormat("vi-VN");
  const en = new QappNumberFormat("en-US");
  assert.equal(vi.format(1234567.5), "1.234.567,5");
  assert.equal(en.format(1234567.5), "1,234,567.5");
  assert.equal(vi.format(999), "999");
  assert.equal(vi.format(1000), "1.000");
  assert.equal(en.format(0), "0");
  assert.equal(en.format(-42), "-42");
  assert.equal(en.format(Number.NaN), "NaN");
  assert.equal(en.format(Number.POSITIVE_INFINITY), "∞");

  // Percent defaults to zero fraction digits, like the platform API.
  assert.equal(new QappNumberFormat("vi-VN", { style: "percent" }).format(0.125), "13%");
  assert.equal(new QappNumberFormat("en-US", { style: "percent" }).format(0.5), "50%");
  assert.equal(
    new QappNumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 }).format(0.125),
    "12,5%",
  );
  assert.equal(
    new QappNumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(2500000),
    "2.500.000 ₫",
  );
  assert.equal(
    new QappNumberFormat("en-US", { style: "currency", currency: "USD" }).format(1234.5),
    "$1,234.50",
  );
  assert.equal(
    new QappNumberFormat("en-US", { style: "currency", currency: "JPY" }).format(1500),
    "¥1,500",
    "a currency without minor units shows none",
  );
  assert.equal(
    new QappNumberFormat("vi-VN", { style: "currency", currency: "JPY" }).format(1500),
    "1.500 ¥",
  );
  assert.equal(
    new QappNumberFormat("en-US", { style: "currency", currency: "XYZ" }).format(1500),
    "XYZ1,500.00",
    "an unknown currency falls back to its code",
  );
  assert.equal(
    new QappNumberFormat("en-US", { notation: "compact" }).format(15200),
    "15.2K",
  );
  assert.equal(new QappNumberFormat("vi-VN", { notation: "compact" }).format(2500000), "2,5 Tr");
  assert.equal(
    new QappNumberFormat("en-US", { minimumFractionDigits: 2 }).format(5),
    "5.00",
  );
  assert.equal(
    new QappNumberFormat("en-US", { signDisplay: "always" }).format(5),
    "+5",
  );
  assert.equal(
    new QappNumberFormat("en-US", { useGrouping: false }).format(1234567),
    "1234567",
  );
  assert.deepEqual(
    new QappNumberFormat("en-US", { style: "currency", currency: "USD" }).formatToParts(1.5),
    [
      { type: "currency", value: "$" },
      { type: "integer", value: "1" },
      { type: "decimal", value: "." },
      { type: "fraction", value: "50" },
    ],
  );
  assert.equal(new QappNumberFormat("vi-VN").resolvedOptions().locale, "vi-VN");
  assert.throws(() => new QappNumberFormat("fr-FR"), RangeError);
  assert.throws(
    () => new QappNumberFormat("en-US", { numberingSystem: "arab" }),
    RangeError,
  );
});

test("Intl DateTimeFormat covers vi-VN and en-US dates and times", () => {
  const viMedium = new QappDateTimeFormat("vi-VN", { dateStyle: "medium", ...UTC });
  const enMedium = new QappDateTimeFormat("en-US", { dateStyle: "medium", ...UTC });
  assert.equal(viMedium.format(INSTANT), "26 thg 10, 2026");
  assert.equal(enMedium.format(INSTANT), "Oct 26, 2026");
  assert.equal(
    new QappDateTimeFormat("vi-VN", { dateStyle: "full", ...UTC }).format(INSTANT),
    "Thứ Hai, 26 tháng 10, 2026",
  );
  assert.equal(
    new QappDateTimeFormat("en-US", { dateStyle: "full", ...UTC }).format(INSTANT),
    "Monday, October 26, 2026",
  );
  assert.equal(
    new QappDateTimeFormat("en-US", { dateStyle: "short", ...UTC }).format(INSTANT),
    "10/26/26",
  );
  assert.equal(
    new QappDateTimeFormat("vi-VN", { dateStyle: "short", ...UTC }).format(INSTANT),
    "26/10/26",
  );
  assert.equal(
    new QappDateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short", ...UTC }).format(
      INSTANT,
    ),
    "10/26/26, 2:05 PM",
  );
  assert.equal(
    new QappDateTimeFormat("vi-VN", { timeStyle: "medium", ...UTC }).format(INSTANT),
    "14:05:09",
  );
  assert.equal(
    new QappDateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "medium", ...UTC }).format(
      INSTANT,
    ),
    "26 tháng 10, 2026 14:05:09",
  );
  assert.equal(
    new QappDateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      ...UTC,
    }).format(INSTANT),
    "October 2026",
  );
  assert.equal(
    new QappDateTimeFormat("vi-VN", { year: "numeric", month: "long", ...UTC }).format(INSTANT),
    "tháng 10 năm 2026",
  );
  assert.equal(
    new QappDateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", ...UTC }).format(
      INSTANT,
    ),
    "26/10/2026",
  );
  assert.equal(
    new QappDateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: false, ...UTC }).format(
      INSTANT,
    ),
    "14:05",
  );
  assert.equal(
    new QappDateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "numeric", ...UTC }).format(
      INSTANT,
    ),
    "Thứ Hai, 26/10",
  );
  assert.deepEqual(
    new QappDateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", ...UTC })
      .formatToParts(INSTANT)
      .map((part) => `${part.type}:${part.value}`),
    ["month:Oct", "literal: ", "day:26", "literal:,", "literal: ", "year:2026"],
  );
  assert.throws(() => new QappDateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh" }), RangeError);
  assert.throws(() => new QappDateTimeFormat("en-US", { dateStyle: "medium" }).format("nope"), RangeError);
  assert.equal(
    new QappDateTimeFormat("en-US", { timeZone: "UTC" }).resolvedOptions().timeZone,
    "UTC",
  );
});

test("installIntl keeps a native Intl and patches toLocaleString otherwise", () => {
  const scope = globalThis as unknown as Record<string, unknown>;
  const native = scope.Intl;
  try {
    scope.Intl = undefined;
    assert.equal(installIntl({ locale: "vi-VN" }), true, "installed on a bare engine");
    assert.equal(installIntl({ locale: "vi-VN" }), true, "installing twice is a no-op");
    assert.equal((1234.5).toLocaleString("vi-VN"), "1.234,5");
    assert.equal(new Date(Date.UTC(2026, 9, 26)).toLocaleDateString("vi-VN"), "26 thg 10, 2026");
  } finally {
    scope.Intl = native;
  }
});

test("installEnv attaches the environment inside the engine and is idempotent", async () => {
  const { appJs } = await bundleEntry(path.join(fixtures, "env-results.tsx"));
  const harness = runBundle(appJs);
  try {
    // The fixture reports only after its timers have run.
    assert.equal(
      harness.logs.some((log) => log.message.startsWith("RESULTS ")),
      false,
      "nothing runs before the host advances its clock",
    );
    assert.equal(harness.timers.nextDelay(), 0);
    harness.timers.advance(0);
    harness.timers.advance(10);
    harness.timers.advance(50);
    const entry = harness.logs.find((log) => log.message.startsWith("RESULTS "));
    assert.ok(entry, "the fixture reported its results");
    const results = JSON.parse(entry.message.slice("RESULTS ".length)) as Record<string, any>;
    assert.deepEqual(results.installed, {
      timers: true,
      console: true,
      structuredClone: true,
      url: true,
      encoding: true,
      abort: true,
      intl: true,
    });
    for (const name of [
      "console",
      "print",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "queueMicrotask",
      "structuredClone",
      "URL",
      "URLSearchParams",
      "TextEncoder",
      "TextDecoder",
      "AbortController",
      "AbortSignal",
      "Intl",
    ]) {
      assert.notEqual(results.types[name], "undefined", `${name} is installed`);
    }
    assert.equal(results.viNumber, "1.234.567,5");
    assert.equal(results.enNumber, "1,234,567.5");
    assert.equal(results.viCurrency, "2.500.000 ₫");
    assert.equal(results.enCompact, "15.2K");
    assert.equal(results.viDate, "26 thg 10, 2026");
    assert.equal(results.enDate, "Monday, October 26, 2026");
    assert.equal(results.numberToLocale, "1.234,5");
    assert.equal(results.url, "https://qchat.vn/a/b?x=1");
    assert.equal(results.urlParams, "https://qchat.vn/?a=1&b=hai+ba");
    assert.deepEqual(results.bytes, [81, 67, 104, 97, 116, 32, 226, 152, 149]);
    assert.equal(results.decoded, "QChat");
    assert.equal(results.clone, '{"a":[1,2],"b":{"c":true}}');
    assert.equal(results.cloneCycle, true);
    assert.equal(results.aborted, true);

    assert.deepEqual(results.order, ["microtask", "early", "late"]);
    assert.equal(harness.timers.pending(), 0);
  } finally {
    harness.dispose();
  }
});
