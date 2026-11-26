import { host } from "../host.js";
import { defineGlobal, installGlobal } from "./scope.js";

/**
 * QuickJS has no `console`. Every call is forwarded to the host as a `log`
 * message, which the Flutter runtime shows in the dev console and the CLI and
 * Studio print from the dev watcher, so `console.log` is observable while
 * developing without being a second logging system.
 */

export type QappLogLevel = "debug" | "info" | "warn" | "error";

export interface QappConsole {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  trace(...args: unknown[]): void;
}

export interface QappLogSink {
  (entry: { level: QappLogLevel; message: string; stack?: string }): void;
}

export const MAX_LOG_LENGTH = 4000;
const MAX_DEPTH = 3;
const MAX_ENTRIES = 40;

function isErrorLike(value: unknown): value is { message: string; stack?: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { message?: unknown; stack?: unknown; name?: unknown };
  return (
    typeof candidate.message === "string" &&
    (typeof candidate.stack === "string" || typeof candidate.name === "string")
  );
}

function describe(value: unknown, depth: number, seen: unknown[]): string {
  if (value === null) return "null";
  const type = typeof value;
  if (type === "string") return value as string;
  if (type === "number" || type === "boolean") return String(value);
  if (type === "undefined") return "undefined";
  if (type === "bigint") return `${String(value)}n`;
  if (type === "symbol") return String(value);
  if (type === "function") {
    const name = (value as { name?: string }).name;
    return name ? `[Function: ${name}]` : "[Function]";
  }
  if (isErrorLike(value)) {
    const name = (value as { name?: string }).name ?? "Error";
    return `${name}: ${value.message}`;
  }
  if (seen.includes(value)) return "[Circular]";
  if (depth > MAX_DEPTH) return Array.isArray(value) ? "[Array]" : "[Object]";
  const nextSeen = [...seen, value];
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ENTRIES)
      .map((item) => describe(item, depth + 1, nextSeen));
    if (value.length > MAX_ENTRIES) items.push(`… ${value.length - MAX_ENTRIES} more`);
    return `[${items.join(", ")}]`;
  }
  const record = value as Record<string, unknown>;
  let entries: string[];
  try {
    entries = Object.keys(record).slice(0, MAX_ENTRIES);
  } catch {
    return "[Object]";
  }
  const body = entries
    .map((key) => {
      let rendered: string;
      try {
        rendered = describe(record[key], depth + 1, nextSeen);
      } catch {
        rendered = "[Unreadable]";
      }
      return `${key}: ${rendered}`;
    })
    .join(", ");
  return `{ ${body} }`;
}

export function formatConsoleArgs(args: unknown[]): {
  message: string;
  stack?: string;
} {
  let stack: string | undefined;
  const parts = args.map((value) => {
    if (
      value instanceof Error ||
      (isErrorLike(value) && typeof (value as { stack?: unknown }).stack === "string")
    ) {
      if (typeof value.stack === "string" && stack === undefined) stack = value.stack;
    }
    return describe(value, 0, []);
  });
  let message = parts.join(" ");
  if (message.length > MAX_LOG_LENGTH) {
    message = `${message.slice(0, MAX_LOG_LENGTH)}… (${message.length - MAX_LOG_LENGTH} more characters)`;
  }
  return stack === undefined ? { message } : { message, stack };
}

export function createConsole(sink: QappLogSink): QappConsole {
  const emit = (level: QappLogLevel, args: unknown[]): void => {
    const { message, stack } = formatConsoleArgs(args);
    try {
      sink(stack === undefined ? { level, message } : { level, message, stack });
    } catch {
      // Logging must never break the app.
    }
  };
  return {
    log: (...args) => emit("info", args),
    info: (...args) => emit("info", args),
    warn: (...args) => emit("warn", args),
    error: (...args) => emit("error", args),
    debug: (...args) => emit("debug", args),
    trace: (...args) => emit("debug", args),
  };
}

function hostSink(entry: {
  level: QappLogLevel;
  message: string;
  stack?: string;
}): void {
  host().send("log", entry);
}

let installed: QappConsole | null = null;

export function installConsole(sink: QappLogSink = hostSink): QappConsole {
  if (installed) return installed;
  installed = createConsole(sink);
  installGlobal("console", () => installed, { force: true });
  defineGlobal("print", (...args: unknown[]) => {
    // QuickJS exposes `print` in its default std module; keep it working and
    // route it to the same sink so nothing writes to an invisible stdout.
    hostSink({ level: "info", ...formatConsoleArgs(args) });
  });
  return installed;
}

/** The console installed by `installConsole()`, if any. */
export function installedConsole(): QappConsole | null {
  return installed;
}
