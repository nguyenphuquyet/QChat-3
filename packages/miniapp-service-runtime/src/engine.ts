/**
 * Service engine contract (ADR 009).
 *
 * The host drives one engine per Mini App session. The engine evaluates the
 * package's JavaScript in an isolated context; it never receives a host object,
 * a file handle or a native reference. Everything the script can reach is the
 * SDK installed into the context plus the single bridge function.
 *
 * Adapters: Node `vm` (tests and the desktop simulator), QuickJS (Android,
 * M2/M5), JavaScriptCore (iOS, M8). The contract is the same on all three.
 */

import type { MiniAppError } from "@qchat/miniapp-contracts";

export const ENGINE_VERSION = 1 as const;

export interface EngineLimits {
  /** Wall-clock limit for one evaluation, in milliseconds. */
  timeoutMs: number;
  /** Heap ceiling reported by the engine where it can enforce one. */
  memoryBytes: number;
  /** Stack ceiling, in bytes. */
  stackBytes: number;
  /** Largest value the engine may return over the bridge. */
  maxResultBytes: number;
}

export const DEFAULT_ENGINE_LIMITS: EngineLimits = {
  timeoutMs: 2000,
  memoryBytes: 64 * 1024 * 1024,
  stackBytes: 1024 * 1024,
  maxResultBytes: 1024 * 1024,
};

export type EngineKind = "node" | "quickjs" | "jsc";

export interface EngineEvaluation {
  ok: boolean;
  /** JSON-serialisable result of the last expression, when `ok`. */
  value?: unknown;
  error?: MiniAppError;
  durationMs: number;
}

export interface ServiceEngine {
  readonly kind: EngineKind;
  /** Evaluate a module or script in the isolated context. */
  evaluate(source: string, filename: string): EngineEvaluation;
  /** Call a global function installed by the SDK. */
  call(functionName: string, args?: readonly unknown[]): EngineEvaluation;
  /** Replace the limits; takes effect on the next evaluation. */
  setLimits(limits: Partial<EngineLimits>): void;
  limits(): Readonly<EngineLimits>;
  /** Heap in use, or `null` when the adapter cannot report it. */
  memoryUsageBytes(): number | null;
  /** Stop the context and reject any later work. */
  terminate(): void;
  terminated(): boolean;
}

export interface EngineOptions {
  limits?: Partial<EngineLimits>;
  /** Console sink; Mini App output must never reach host logs verbatim. */
  onConsole?: (level: "log" | "warn" | "error", args: unknown[]) => void;
}

/** Shared argument checks so every adapter behaves the same. */
export function checkEngineArgs(functionName: string, args: readonly unknown[]): MiniAppError | null {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(functionName)) {
    return { code: "RUNTIME_SCRIPT_ERROR", message: "Invalid global function name." };
  }
  try {
    const serialized = JSON.stringify(args);
    if (serialized !== undefined && serialized.length > DEFAULT_ENGINE_LIMITS.maxResultBytes) {
      return { code: "BRIDGE_TOO_LARGE", message: "Engine arguments are too large." };
    }
  } catch {
    return { code: "BRIDGE_INVALID_MESSAGE", message: "Engine arguments must be JSON-serialisable." };
  }
  return null;
}

export function isJsonValue(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}
