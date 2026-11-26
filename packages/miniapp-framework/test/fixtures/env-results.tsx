// Exercises the installed environment and reports the results over the host
// log channel, so the same fixture can run in the Node harness and in real
// QuickJS. Timers are reported last, after the host has advanced the clock.
import { installEnv } from "@mna/qchat/env";

const scope = globalThis as unknown as Record<string, any>;
const native = scope.__qchatNative as { send(kind: string, payload: unknown): void };

const installed = installEnv({ locale: "vi-VN" });

const order: string[] = [];
const results: Record<string, unknown> = {
  installed,
  types: Object.fromEntries(
    [
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
    ].map((name) => [name, typeof scope[name]]),
  ),
  viNumber: new Intl.NumberFormat("vi-VN").format(1234567.5),
  enNumber: new Intl.NumberFormat("en-US").format(1234567.5),
  viCurrency: new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(2500000),
  enCompact: new Intl.NumberFormat("en-US", { notation: "compact" }).format(15200),
  viDate: new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 9, 26))),
  enDate: new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 9, 26))),
  numberToLocale: (1234.5).toLocaleString("vi-VN"),
  url: String(new URL("/a/b?x=1", "https://qchat.vn/base/")),
  urlParams: (() => {
    const link = new URL("https://qchat.vn/?a=1");
    link.searchParams.append("b", "hai ba");
    return link.toString();
  })(),
  bytes: Array.from(new TextEncoder().encode("QChat ☕")),
  decoded: new TextDecoder().decode(new Uint8Array([81, 67, 104, 97, 116])),
  clone: JSON.stringify(structuredClone({ a: [1, 2], b: { c: true } })),
  cloneCycle: (() => {
    const source: Record<string, unknown> = { name: "loop" };
    source.self = source;
    const copy = structuredClone(source) as Record<string, unknown>;
    return copy !== source && copy.self === copy;
  })(),
  aborted: (() => {
    const controller = new AbortController();
    controller.abort();
    return controller.signal.aborted;
  })(),
  order,
};

setTimeout(() => order.push("late"), 30);
setTimeout(() => order.push("early"), 10);
const cancelled = setTimeout(() => order.push("cancelled"), 5);
clearTimeout(cancelled);
queueMicrotask(() => order.push("microtask"));
setTimeout(() => {
  native.send("log", {
    level: "info",
    message: `RESULTS ${JSON.stringify(results)}`,
  });
}, 60);
