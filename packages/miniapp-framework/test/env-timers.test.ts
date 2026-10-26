import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { bundleEntry } from "../src/compiler.js";
import { createTimerQueue, MAX_TIMERS_PER_TICK } from "../src/env/timers.js";
import { runBundle, type HarnessLog, type HarnessResult } from "../src/tester.js";

const fixtures = path.join(import.meta.dirname, "fixtures");

async function open(fixture: string): Promise<HarnessResult> {
  const { appJs } = await bundleEntry(path.join(fixtures, fixture));
  return runBundle(appJs);
}

function messageOf(harness: HarnessResult, prefix: string): unknown {
  const entry = harness.logs.find((log) => log.message.startsWith(prefix));
  assert.ok(entry, `no log starting with ${prefix}`);
  return entry.message.slice(prefix.length);
}

function findLog(harness: HarnessResult, message: string): HarnessLog | undefined {
  return harness.logs.find((log) => log.message === message);
}

const MISSING_IN_QUICKJS = [
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
];

test("the harness sandbox exposes only what QuickJS provides", async () => {
  const harness = await open("fidelity.tsx");
  try {
    const types = Object.fromEntries(
      harness.logs.map((entry) => {
        const [name, value] = entry.message.split("=");
        return [name, value];
      }),
    );
    for (const name of MISSING_IN_QUICKJS) {
      assert.equal(types[name], "undefined", `${name} must not exist before installEnv`);
    }
    for (const name of ["Promise", "Date", "Map", "Set", "Uint8Array"]) {
      assert.equal(types[name], "function", `${name} is an ECMAScript built-in`);
    }
    assert.equal(types.JSON, "object", "the fixture reported itself, so the bridge works");
  } finally {
    harness.dispose();
  }
});

test("timers run in due order, keep registration order and honour clearing", async () => {
  const harness = await open("timers.tsx");
  try {
    assert.equal(messageOf(harness, "READY "), "[]");
    assert.equal(harness.timers.nextDelay(), 0, "microtask and frame are due now");

    harness.timers.advance(9);
    assert.equal(
      harness.logs.some((log) => log.message.startsWith("RESULT ")),
      false,
      "nothing else is due at 9 ms",
    );
    assert.equal(harness.timers.pending(), 7, "the planned timers are still scheduled");

    harness.timers.advance(71);
    // `cancelled` never ran, the interval repeated until its clearing timer and
    // `inner` was scheduled at 80 ms, so it is still waiting at 80 ms.
    assert.deepEqual(JSON.parse(String(messageOf(harness, "RESULT "))), [
      "microtask",
      "frame",
      "t10a",
      "t10b",
      "interval1",
      "outer",
      "t20",
      "interval2",
      "interval3",
      "interval-cleared",
      "report",
    ]);
    assert.equal(harness.timers.pending(), 1, "only the nested 5 ms timer is left");
    assert.equal(harness.timers.nextDelay(), 5);

    assert.equal(harness.timers.advance(5), 1);
    assert.ok(findLog(harness, "INNER"), "the nested timer runs 5 ms after it was scheduled");
    assert.equal(harness.timers.pending(), 0);
    assert.equal(harness.timers.nextDelay(), null, "the queue asks the host to stop");
  } finally {
    harness.dispose();
  }
});

test("one host tick is bounded so a fast interval cannot stall the frame", async () => {
  const harness = await open("interval-flood.tsx");
  try {
    const ran = harness.timers.advance(1000);
    assert.equal(ran, 500, "MAX_TIMERS_PER_TICK bounds a single tick");
    assert.equal(harness.timers.pending(), 1, "the interval is still scheduled");
  } finally {
    harness.dispose();
  }
});

test("the queue validates its input and caps one tick", () => {
  let now = 0;
  const queue = createTimerQueue({ now: () => now, wake: () => {} });
  const ran: string[] = [];
  const interval = queue.setInterval(() => ran.push("tick"), 1);
  now = 10_000;
  assert.equal(queue.tick(now), MAX_TIMERS_PER_TICK);
  assert.equal(queue.pending(), 1);
  queue.clearInterval(interval);
  assert.equal(queue.pending(), 0);

  // A non-function callback is ignored instead of crashing the frame.
  assert.equal(queue.setTimeout(undefined as unknown as () => void, 5), 0);
  // Negative and non-finite delays clamp to "as soon as possible".
  const immediate = queue.setTimeout(() => ran.push("now"), -5);
  assert.ok(immediate > 0);
  assert.equal(queue.nextDelay(now), 0);
  assert.equal(queue.tick(now), 1);
  assert.deepEqual(ran.slice(-1), ["now"]);
});

test("console forwards every level and formats values for the host", async () => {
  const harness = await open("timers.tsx");
  try {
    const levels = new Map(harness.logs.map((log) => [log.message, log.level]));
    assert.equal(levels.get("a warning"), "warn");
    assert.equal(levels.get("a debug line"), "debug");
    assert.equal(levels.get("an error line"), "error");
    assert.equal(levels.get("READY []"), "info");
    assert.equal(
      findLog(harness, "objects { nested: { deep: { deeper: 1 } } } [1, two] null undefined")
        ?.level,
      "info",
    );
    assert.equal(findLog(harness, "circular { name: loop, self: [Circular] }")?.level, "info");
    // `console.log("error", new Error(...))` is an info line that still carries
    // the stack, and `console.error` sets the level.
    const error = findLog(harness, "error Error: boom");
    assert.equal(error?.level, "info");
    assert.ok(typeof error?.stack === "string" && error.stack.includes("boom"));
  } finally {
    harness.dispose();
  }
});
