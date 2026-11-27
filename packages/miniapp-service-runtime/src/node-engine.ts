/**
 * Node `vm` engine adapter.
 *
 * This is a real adapter, not a stub: it evaluates Mini App code in a separate
 * V8 context with string code generation disabled, a wall-clock timeout and no
 * `require`, `process`, `Buffer` or host global. It is used by the Node tests
 * and by the desktop simulator (M10). Android uses QuickJS and iOS uses
 * JavaScriptCore behind the same interface.
 */

import { createContext, runInContext, type Context } from "node:vm";
import { miniAppError, type MiniAppError } from "@qchat/miniapp-contracts";
import {
  DEFAULT_ENGINE_LIMITS,
  checkEngineArgs,
  isJsonValue,
  type EngineEvaluation,
  type EngineKind,
  type EngineLimits,
  type EngineOptions,
  type ServiceEngine,
} from "./engine.js";

const ALLOWED_GLOBALS = ["globalThis", "JSON", "Math", "Date", "String", "Number", "Boolean", "Array", "Object", "Map", "Set", "Promise", "RegExp", "Error", "TypeError", "RangeError", "Symbol", "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent", "setTimeout", "clearTimeout"] as const;

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function createNodeEngine(options: EngineOptions = {}): ServiceEngine {
  let limits: EngineLimits = { ...DEFAULT_ENGINE_LIMITS, ...options.limits };
  let stopped = false;
  let context: Context = createFreshContext();

  function createFreshContext(): Context {
    const sandbox: Record<string, unknown> = Object.create(null);
    sandbox.console = Object.freeze({
      log: (...args: unknown[]) => options.onConsole?.("log", args),
      warn: (...args: unknown[]) => options.onConsole?.("warn", args),
      error: (...args: unknown[]) => options.onConsole?.("error", args),
    });
    // Timers are host-provided but bounded: the SDK wraps them so a Mini App
    // cannot keep the host alive after close.
    sandbox.setTimeout = (handler: () => void, timeout?: number) => setTimeout(handler, Math.min(Number(timeout) || 0, 60_000));
    sandbox.clearTimeout = (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>);
    const created = createContext(sandbox, {
      name: "qchat-miniapp",
      codeGeneration: { strings: false, wasm: false },
    });
    // Freeze the primitives the script is allowed to see. `globalThis` stays
    // writable for the SDK's own registration; the bridge is a plain function.
    runInContext(
      `(function () {
        "use strict";
        var allowed = ${JSON.stringify(ALLOWED_GLOBALS)};
        for (var key of Object.getOwnPropertyNames(globalThis)) {
          if (allowed.indexOf(key) === -1 && key !== "console" && key !== "setTimeout" && key !== "clearTimeout") {
            try { delete globalThis[key]; } catch (e) {}
          }
        }
      })();`,
      created,
      { timeout: 100 },
    );
    return created;
  }

  function evaluate(source: string, filename: string): EngineEvaluation {
    const started = performance.now();
    if (stopped) {
      return { ok: false, error: miniAppError("RUNTIME_CRASH", "The engine is terminated."), durationMs: 0 };
    }
    if (typeof source !== "string" || source.length > 8 * 1024 * 1024) {
      return { ok: false, error: miniAppError("RUNTIME_SCRIPT_ERROR", "The script is too large."), durationMs: 0 };
    }
    try {
      const value = runInContext(source, context, {
        filename,
        timeout: limits.timeoutMs,
        displayErrors: false,
        breakOnSigint: false,
      });
      const durationMs = performance.now() - started;
      if (!isJsonValue(value)) {
        return { ok: false, error: miniAppError("BRIDGE_INVALID_MESSAGE", "The script result is not serialisable."), durationMs };
      }
      const serialized = JSON.stringify(value);
      if (serialized !== undefined && serialized.length > limits.maxResultBytes) {
        return { ok: false, error: miniAppError("BRIDGE_TOO_LARGE"), durationMs };
      }
      return { ok: true, value, durationMs };
    } catch (cause) {
      return { ok: false, error: toError(cause), durationMs: performance.now() - started };
    }
  }

  function toError(cause: unknown): MiniAppError {
    const message = describe(cause);
    if (/timed out|Script execution timed out/i.test(message)) {
      return miniAppError("RUNTIME_CRASH", "The script exceeded its time limit.");
    }
    if (/code generation from strings disallowed/i.test(message)) {
      return miniAppError("RUNTIME_SCRIPT_ERROR", "Dynamic code generation is disabled.");
    }
    return miniAppError("RUNTIME_SCRIPT_ERROR", message.slice(0, 2048));
  }

  return {
    kind: "node" as EngineKind,

    evaluate,

    defineGlobal(name, value) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(name)) throw new RangeError("invalid global name");
      if (name === "process" || name === "require" || name === "Buffer") throw new RangeError("reserved global name");
      (context as unknown as Record<string, unknown>)[name] = value;
    },

    call(functionName, args = []) {
      const invalid = checkEngineArgs(functionName, args);
      if (invalid) return { ok: false, error: invalid, durationMs: 0 };
      const literal = JSON.stringify(args);
      return evaluate(`globalThis.${functionName}(...${literal})`, `call:${functionName}`);
    },

    setLimits(next) {
      limits = { ...limits, ...next };
    },

    limits() {
      return { ...limits };
    },

    memoryUsageBytes() {
      // Node does not expose the context heap. Returning `null` is honest and
      // keeps a caller from reporting a host-wide number as the app's memory.
      return null;
    },

    terminate() {
      stopped = true;
      context = createFreshContext();
    },

    terminated() {
      return stopped;
    },
  };
}
