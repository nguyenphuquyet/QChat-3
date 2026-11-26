import { globalValue } from "./scope.js";

/**
 * QuickJS has no `AbortController`. The signal is honoured by the SDK's own
 * host calls: an aborted request rejects with the standard `AbortError`. The
 * host keeps running its own work because a QuickJS JSON bridge has no cancel
 * channel, so the abort only stops the promise from resolving in the app.
 */

export interface QappAbortEvent {
  type: "abort";
  target: QappAbortSignalLike;
}

export type QappAbortReason = unknown;

export interface QappAbortSignalLike {
  readonly aborted: boolean;
  readonly reason: QappAbortReason;
  onabort: ((event: QappAbortEvent) => void) | null;
  addEventListener(type: "abort", listener: (event: QappAbortEvent) => void): void;
  removeEventListener(type: "abort", listener: (event: QappAbortEvent) => void): void;
  throwIfAborted(): void;
}

export interface AbortSignalStatics {
  abort(reason?: QappAbortReason): QappAbortSignalLike;
  timeout(milliseconds: number): QappAbortSignalLike;
}

export function createAbortError(reason?: QappAbortReason): Error {
  const error = new Error(
    reason === undefined ? "The operation was aborted" : String(reason),
  );
  error.name = "AbortError";
  return error;
}

export class QappAbortSignal implements QappAbortSignalLike {
  aborted = false;
  reason: QappAbortReason = undefined;
  onabort: ((event: QappAbortEvent) => void) | null = null;
  private listeners = new Set<(event: QappAbortEvent) => void>();

  addEventListener(_type: "abort", listener: (event: QappAbortEvent) => void): void {
    if (typeof listener === "function") this.listeners.add(listener);
  }

  removeEventListener(_type: "abort", listener: (event: QappAbortEvent) => void): void {
    this.listeners.delete(listener);
  }

  /** Internal: mark the signal aborted and notify listeners once. */
  dispatch(reason?: QappAbortReason): void {
    if (this.aborted) return;
    this.aborted = true;
    this.reason = reason;
    const event: QappAbortEvent = { type: "abort", target: this };
    const handler = this.onabort;
    const listeners = [...this.listeners];
    this.listeners.clear();
    if (typeof handler === "function") {
      try {
        handler(event);
      } catch {
        // A broken listener must not break the abort path.
      }
    }
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Same here.
      }
    }
  }

  throwIfAborted(): void {
    if (this.aborted) throw createAbortError(this.reason);
  }

  static abort(reason?: QappAbortReason): QappAbortSignal {
    const signal = new QappAbortSignal();
    signal.dispatch(reason === undefined ? createAbortError() : reason);
    return signal;
  }

  /** Needs the timers installed; `setTimeout` is what fires the abort. */
  static timeout(milliseconds: number): QappAbortSignal {
    const signal = new QappAbortSignal();
    const timer = globalValue("setTimeout") as
      | ((handler: () => void, delayMs?: number) => number)
      | undefined;
    if (typeof timer !== "function") {
      throw new Error(
        "AbortSignal.timeout needs the timers installed (@mna/qchat/env)",
      );
    }
    timer(
      () => signal.dispatch(createAbortError("The operation timed out")),
      milliseconds,
    );
    return signal;
  }
}

export class QappAbortController {
  readonly signal: QappAbortSignal;

  constructor() {
    this.signal = new QappAbortSignal();
  }

  abort(reason?: QappAbortReason): void {
    this.signal.dispatch(
      reason === undefined ? createAbortError() : reason,
    );
  }
}

let installed = false;

export function installAbort(): void {
  if (installed) return;
  installed = true;
  const scope = globalThis as unknown as Record<string, unknown>;
  scope.AbortController = QappAbortController;
  scope.AbortSignal = QappAbortSignal;
}

/** True while the signal is already aborted, used before a host call. */
export function assertNotAborted(signal?: QappAbortSignalLike | null): void {
  if (signal && signal.aborted) throw createAbortError(signal.reason);
}
