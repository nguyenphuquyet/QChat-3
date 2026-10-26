import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { getQuickJS } from "quickjs-emscripten";
import { bundleEntry } from "../src/compiler.js";

/**
 * Runs a bundle in a real QuickJS engine, with only the two globals the Flutter
 * host installs: `__qchatNative` (the JSON bridge) and the timer wake protocol.
 * Nothing from Node or the browser is injected, so a missing polyfill fails here
 * exactly like it would on a device.
 */
const fixtures = path.join(import.meta.dirname, "fixtures");
const example = path.join(
  import.meta.dirname,
  "../../miniapp-examples/env-demo/src/main.tsx",
);

interface QuickJsRun {
  logs: Array<{ level: string; message: string; stack?: string }>;
  renders: Array<{ v: number; revision: number; root: Node }>;
  /** How far the host clock was advanced while driving the timers. */
  elapsed: number;
}

type Node = {
  type?: string;
  props?: Record<string, unknown>;
  children?: Node[];
} | null;

function textOf(node: Node): string {
  if (!node) return "";
  const props = node.props ?? {};
  if (typeof props.text === "string") return props.text;
  return (node.children ?? []).map((child) => textOf(child)).join("");
}

const MISSING = [
  "setTimeout",
  "console",
  "Intl",
  "URL",
  "URLSearchParams",
  "TextEncoder",
  "TextDecoder",
  "AbortController",
  "structuredClone",
  "queueMicrotask",
];

async function runInQuickJs(appJs: string): Promise<QuickJsRun> {
  const QuickJS = await getQuickJS();
  const vm = QuickJS.newContext();
  const logs: QuickJsRun["logs"] = [];
  const renders: QuickJsRun["renders"] = [];
  let pendingWake: number | null = null;
  let elapsed = 0;
  try {
    const absent = vm.evalCode(
      `[${MISSING.map((name) => `typeof ${name}`).join(", ")}].join(",")`,
    );
    assert.ok(!absent.error, "the probe must run in QuickJS");
    assert.equal(
      vm.dump(absent.value),
      MISSING.map(() => "undefined").join(","),
      "QuickJS really does start without the environment",
    );
    absent.value.dispose();

    const native = vm.newObject();
    const send = vm.newFunction("send", (kindHandle, payloadHandle) => {
      const kind = vm.dump(kindHandle) as string;
      const payload = vm.dump(payloadHandle) as Record<string, any>;
      if (kind === "log") {
        logs.push({
          level: String(payload?.level ?? "info"),
          message: String(payload?.message ?? ""),
          stack: typeof payload?.stack === "string" ? payload.stack : undefined,
        });
      } else if (kind === "render") {
        renders.push(payload as unknown as QuickJsRun["renders"][number]);
      } else if (kind === "timer") {
        const delay = payload?.delayMs;
        pendingWake = typeof delay === "number" && delay >= 0 ? delay : null;
      }
    });
    vm.setProp(native, "send", send);
    send.dispose();
    const call = vm.newFunction("call", () => undefined);
    vm.setProp(native, "call", call);
    call.dispose();
    vm.setProp(vm.global, "__qchatNative", native);
    native.dispose();

    // `Date.now` is the only clock QuickJS offers, and the device reads the
    // real one. Here it is replaced with a counter the loop below advances, so
    // the timer queue is driven by exact numbers instead of however long the
    // host took to come back. The wake protocol itself is untouched: the bundle
    // still calls `__qchatNative.send("timer", { delayMs })` like on a device.
    const clock = vm.evalCode(
      "globalThis.__qchatVirtualNow = 0; Date.now = function () { return globalThis.__qchatVirtualNow; };",
    );
    assert.ok(!clock.error, "the virtual clock must install in QuickJS");
    clock.value.dispose();

    const evaluated = vm.evalCode(appJs, "qapp://app.js");
    if (evaluated.error) {
      const message = vm.dump(evaluated.error);
      evaluated.error.dispose();
      throw new Error(`QuickJS failed to run the bundle: ${JSON.stringify(message)}`);
    }
    evaluated.value.dispose();

    // The Flutter host honours the requested delay and calls the tick entry
    // point in return, which is the whole timer contract. The loop below plays
    // that host: it advances a virtual clock by the delay the bundle asked for
    // and never waits for real time, so `elapsed` is exact.
    for (let step = 0; step < 200 && pendingWake !== null; step++) {
      elapsed += pendingWake;
      pendingWake = null;
      const tick = vm.evalCode(
        `globalThis.__qchatVirtualNow = ${elapsed};` +
          `globalThis.__qchatTickTimers && globalThis.__qchatTickTimers(${elapsed});`,
      );
      if (tick.error) {
        const message = vm.dump(tick.error);
        tick.error.dispose();
        throw new Error(`QuickJS failed while running timers: ${JSON.stringify(message)}`);
      }
      tick.value.dispose();
    }
    return { logs, renders, elapsed };
  } finally {
    vm.dispose();
  }
}

function resultsOf(run: QuickJsRun): Record<string, any> {
  const entry = run.logs.find((log) => log.message.startsWith("RESULTS "));
  assert.ok(entry, "the environment reported its results");
  return JSON.parse(entry.message.slice("RESULTS ".length));
}

test("the whole environment runs in real QuickJS", async () => {
  const { appJs } = await bundleEntry(path.join(fixtures, "env-results.tsx"));
  const run = await runInQuickJs(appJs);
  const results = resultsOf(run);

  for (const [name, type] of Object.entries(results.types as Record<string, string>)) {
    assert.notEqual(type, "undefined", `${name} is installed in QuickJS`);
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

  // Timers: order, clearing and the host-driven clock.
  assert.deepEqual(results.order, ["microtask", "early", "late"]);
  assert.equal(run.elapsed, 60, "the host advanced exactly to the last timer");
});

test("a real app using the environment renders and updates in QuickJS", async () => {
  const { appJs } = await bundleEntry(example);
  const run = await runInQuickJs(appJs);
  assert.ok(run.renders.length > 0, "the app rendered at least one frame");

  const first = textOf(run.renders[0].root);
  assert.ok(first.includes("QChat environment"));
  assert.ok(
    first.includes("So: 1.234.567,5 | 1,234,567.5 | 13% | 2.500.000 ₫ | $1,234.50 | 15.2K"),
    `numbers came from the Intl polyfill: ${first}`,
  );
  assert.ok(
    first.includes("Ngay: 26 thg 10, 2026 | Monday, October 26, 2026 | 10/26/26, 2:05 PM | 14:05"),
    `dates came from the Intl polyfill: ${first}`,
  );
  assert.ok(first.includes("URL: https://qchat.vn/api/items?page=3&q=xin+ch%C3%A0o"));
  assert.ok(first.includes("Bytes: 9 bytes"));
  assert.ok(first.includes("Clone: true/3"));
  assert.ok(first.includes("Aborted: true"));
  assert.ok(first.includes("Timers: waiting"), "no timer has run yet");

  const last = textOf(run.renders[run.renders.length - 1].root);
  assert.ok(last.includes("Timers: early,late"), `timer order: ${last}`);
  assert.ok(last.includes("Ticks: 3"), `the interval ran three times: ${last}`);
  assert.ok(last.includes("Aborted: true"));

  // Console output goes through the host channel, with the levels the app used.
  const levels = new Map(run.logs.map((log) => [log.message, log.level]));
  assert.equal(levels.get("this is a warning"), "warn");
  assert.equal(levels.get("this is debug output"), "debug");
  assert.ok(
    [...levels.keys()].some((message) => message.startsWith("env demo ready")),
    "console.log reached the host",
  );
});
