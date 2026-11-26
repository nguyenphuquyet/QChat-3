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
export declare const MAX_TIMERS = 512;
export declare const MAX_TIMERS_PER_TICK = 500;
export declare function createTimerQueue(scheduler: QappTimerScheduler): QappTimerQueue;
/**
 * A host may drive the clock itself by defining `__qchatTimerScheduler`
 * before the bundle runs (`{ now(): number, wake(delayMs: number): void }`).
 * The test harness uses it for a deterministic virtual clock; the Flutter host
 * does not need it and receives `send("timer", { delayMs })` instead.
 */
export declare function hostScheduler(): QappTimerScheduler;
/** The queue the installed globals use; also the tick entry point. */
export declare function createHostTimerQueue(scheduler?: QappTimerScheduler): QappTimerQueue;
/** The queue installed by `installTimers()`, if any. */
export declare function installedTimerQueue(): QappTimerQueue | null;
export declare function installTimers(queue?: QappTimerQueue): QappTimerQueue;
//# sourceMappingURL=timers.d.ts.map