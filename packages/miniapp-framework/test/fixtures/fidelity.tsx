// Reports `typeof` for every global the QuickJS environment owns, using the
// raw host channel because `console` itself is not installed here.
const scope = globalThis as unknown as Record<string, any>;
const native = scope.__qchatNative as { send(kind: string, payload: unknown): void };

const names = [
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
  "Promise",
  "Date",
  "Map",
  "Set",
  "Uint8Array",
  "JSON",
];

for (const name of names) {
  native.send("log", { level: "info", message: `${name}=${typeof scope[name]}` });
}
