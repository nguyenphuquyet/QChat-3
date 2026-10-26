import { host } from "../host.js";
import { defineGlobal, globalValue, installGlobal } from "./scope.js";

/**
 * QuickJS has no event loop and no timers. The JavaScript side keeps the queue
 * and asks the host to wake it up: `host().send("timer", { delayMs })` where a
 * negative `delayMs` cancels the pending wake. The host answers by calling
 * `globalThis.__qchatTickTimers(nowMs)`, which runs everything that is due.
 *
 * Keeping the queue in JavaScript means the whole thing is deterministic and
 * testable without a real clock: the test harness drives the same tick entry
 * point with a virtual timestamp.
 */

export interface QappTimerScheduler {
  /** `delayMs < 0` cancels the pending wake; `0` means "next frame". */
  wake(delayMs: number): void;
  now(): number;
}

export type QappTimerKind = "timeout" | "interval" | "frame" | "microtask";

export interface QappTimerEntry {
  id: number;
  kind: QappTimerKind;
  due: number;
  interval: number;
  order: number;
  callback: (...args: unknown[]) => void;
  args: unknown[];
  /** The timestamp passed to `requestAnimationFrame` callbacks. */
  frameTime: number;
}

export interface QappTimerQueue {
  setTimeout(handler: (...args: any[]) => void, delayMs?: number, ...args: unknown[]): number;
  clearTimeout(id?: number): void;
  setInterval(handler: (...args: any[]) => void, delayMs?: number, ...args: unknown[]): number;
  clearInterval(id?: number): void;
  requestAnimationFrame(handler: (time: number) => void): number;
  cancelAnimationFrame(id?: number): void;
  queueMicrotask(handler: () => void): void;
  /** Runs every entry due at `nowMs`; returns how many callbacks ran. */
  tick(nowMs?: number): number;
  pending(): number;
  /** Delay the host should wait for before the next tick, or `null`. */
  nextDelay(nowMs?: number): number | null;
  onError(handler: (error: unknown) => void): void;
  clearAll(): void;
}

export const MAX_TIMERS = 512;
export const MAX_TIMERS_PER_TICK = 500;
const MAX_DELAY = 2147483647;

function clampDelay(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Math.floor(number), MAX_DELAY);
}

export function createTimerQueue(scheduler: QappTimerScheduler): QappTimerQueue {
  const timers = new Map<number, QappTimerEntry>();
  let sequence = 0;
  let nextId = 1;
  let ticking = false;
  let errorHandler: (error: unknown) => void = () => {};

  const arm = (): void => {
    if (ticking) return;
    const delay = nextDelay();
    scheduler.wake(delay === null ? -1 : delay);
  };

  const nextDelay = (nowMs?: number): number | null => {
    let earliest: number | null = null;
    for (const entry of timers.values()) {
      if (earliest === null || entry.due < earliest) earliest = entry.due;
    }
    if (earliest === null) return null;
    const now = nowMs ?? scheduler.now();
    return Math.max(0, earliest - now);
  };

  const schedule = (
    kind: QappTimerKind,
    callback: (...args: any[]) => void,
    delayMs: unknown,
    interval: boolean,
    args: unknown[],
  ): number => {
    if (typeof callback !== "function") return 0;
    if (timers.size >= MAX_TIMERS) {
      errorHandler(
        new Error(
          `QChat timer limit reached (${MAX_TIMERS}); the timer was not scheduled`,
        ),
      );
      return 0;
    }
    const now = scheduler.now();
    const delay = clampDelay(delayMs);
    const id = nextId++;
    timers.set(id, {
      id,
      kind,
      due: kind === "interval" ? now + Math.max(1, delay) : now + delay,
      interval: interval ? Math.max(1, delay) : 0,
      order: sequence++,
      callback,
      args,
      frameTime: now + delay,
    });
    arm();
    return id;
  };

  const clear = (id: unknown): void => {
    const key = typeof id === "number" ? id : Number(id);
    if (!Number.isFinite(key)) return;
    if (!timers.delete(key)) return;
    arm();
  };

  function tick(nowMs?: number): number {
    if (ticking) return 0;
    ticking = true;
    let ran = 0;
    try {
      const now = nowMs ?? scheduler.now();
      while (ran < MAX_TIMERS_PER_TICK) {
        let next: QappTimerEntry | null = null;
        for (const entry of timers.values()) {
          if (entry.due > now) continue;
          if (
            next === null ||
            entry.due < next.due ||
            (entry.due === next.due && entry.order < next.order)
          ) {
            next = entry;
          }
        }
        if (!next) break;
        if (next.kind === "interval") next.due += next.interval;
        else timers.delete(next.id);
        ran++;
        try {
          if (next.kind === "frame") next.callback(next.frameTime);
          else next.callback(...next.args);
        } catch (error) {
          errorHandler(error);
        }
      }
    } finally {
      ticking = false;
    }
    arm();
    return ran;
  }

  return {
    setTimeout(handler, delayMs, ...args) {
      return schedule("timeout", handler, delayMs, false, args);
    },
    clearTimeout(id) {
      clear(id);
    },
    setInterval(handler, delayMs, ...args) {
      return schedule("interval", handler, delayMs, true, args);
    },
    clearInterval(id) {
      clear(id);
    },
    requestAnimationFrame(handler) {
      // The host tick is the frame: `rAF` runs on the next tick with a zero
      // delay, which is the closest a QuickJS host can get to a paint.
      return schedule("frame", handler as (...args: any[]) => void, 0, false, []);
    },
    cancelAnimationFrame(id) {
      clear(id);
    },
    queueMicrotask(handler) {
      schedule("microtask", handler, 0, false, []);
    },
    tick,
    pending: () => timers.size,
    nextDelay,
    onError(handler) {
      errorHandler = handler;
    },
    clearAll() {
      timers.clear();
      arm();
    },
  };
}

/**
 * A host may drive the clock itself by defining `__qchatTimerScheduler`
 * before the bundle runs (`{ now(): number, wake(delayMs: number): void }`).
 * The test harness uses it for a deterministic virtual clock; the Flutter host
 * does not need it and receives `send("timer", { delayMs })` instead.
 */
export function hostScheduler(): QappTimerScheduler {
  const hook = globalValue("__qchatTimerScheduler") as
    | Partial<QappTimerScheduler>
    | undefined;
  if (
    hook &&
    typeof hook.wake === "function" &&
    typeof hook.now === "function"
  ) {
    return hook as QappTimerScheduler;
  }
  return {
    wake(delayMs) {
      // A negative delay tells the host that no timer is pending. Sending a
      // frame must never crash the app, and host() already guards that.
      host().send("timer", { delayMs });
    },
    now: () => {
      const date = globalValue("Date") as { now(): number } | undefined;
      return date && typeof date.now === "function" ? date.now() : 0;
    },
  };
}

/** The queue the installed globals use; also the tick entry point. */
export function createHostTimerQueue(scheduler?: QappTimerScheduler): QappTimerQueue {
  const queue = createTimerQueue(scheduler ?? hostScheduler());
  queue.onError((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? error.stack : undefined;
    host().send("log", { level: "error", message, stack });
  });
  return queue;
}

let installed: QappTimerQueue | null = null;

/** The queue installed by `installTimers()`, if any. */
export function installedTimerQueue(): QappTimerQueue | null {
  return installed;
}

export function installTimers(queue?: QappTimerQueue): QappTimerQueue {
  queue ??= createHostTimerQueue();
  if (installed) return installed;
  installed = queue;
  defineGlobal("setTimeout", queue.setTimeout);
  defineGlobal("clearTimeout", queue.clearTimeout);
  defineGlobal("setInterval", queue.setInterval);
  defineGlobal("clearInterval", queue.clearInterval);
  defineGlobal("requestAnimationFrame", queue.requestAnimationFrame);
  defineGlobal("cancelAnimationFrame", queue.cancelAnimationFrame);
  defineGlobal("queueMicrotask", queue.queueMicrotask);
  // Host entry points: the tick that runs due callbacks, plus two probes the
  // test harness uses to assert timer state. Installed even when the engine has
  // its own `queueMicrotask`, so one tick drives every callback.
  installGlobal("__qchatTickTimers", () => (nowMs?: number) => queue.tick(nowMs), {
    force: true,
  });
  installGlobal("__qchatTimerPending", () => () => queue.pending(), { force: true });
  installGlobal("__qchatTimerClearAll", () => () => queue.clearAll(), { force: true });
  return installed;
}
