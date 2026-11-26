import { host } from "../host.js";
import { defineGlobal, globalValue, installGlobal } from "./scope.js";
export const MAX_TIMERS = 512;
export const MAX_TIMERS_PER_TICK = 500;
const MAX_DELAY = 2147483647;
function clampDelay(value) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number) || number <= 0)
        return 0;
    return Math.min(Math.floor(number), MAX_DELAY);
}
export function createTimerQueue(scheduler) {
    const timers = new Map();
    let sequence = 0;
    let nextId = 1;
    let ticking = false;
    let errorHandler = () => { };
    const arm = () => {
        if (ticking)
            return;
        const delay = nextDelay();
        scheduler.wake(delay === null ? -1 : delay);
    };
    const nextDelay = (nowMs) => {
        let earliest = null;
        for (const entry of timers.values()) {
            if (earliest === null || entry.due < earliest)
                earliest = entry.due;
        }
        if (earliest === null)
            return null;
        const now = nowMs ?? scheduler.now();
        return Math.max(0, earliest - now);
    };
    const schedule = (kind, callback, delayMs, interval, args) => {
        if (typeof callback !== "function")
            return 0;
        if (timers.size >= MAX_TIMERS) {
            errorHandler(new Error(`QChat timer limit reached (${MAX_TIMERS}); the timer was not scheduled`));
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
    const clear = (id) => {
        const key = typeof id === "number" ? id : Number(id);
        if (!Number.isFinite(key))
            return;
        if (!timers.delete(key))
            return;
        arm();
    };
    function tick(nowMs) {
        if (ticking)
            return 0;
        ticking = true;
        let ran = 0;
        try {
            const now = nowMs ?? scheduler.now();
            while (ran < MAX_TIMERS_PER_TICK) {
                let next = null;
                for (const entry of timers.values()) {
                    if (entry.due > now)
                        continue;
                    if (next === null ||
                        entry.due < next.due ||
                        (entry.due === next.due && entry.order < next.order)) {
                        next = entry;
                    }
                }
                if (!next)
                    break;
                if (next.kind === "interval")
                    next.due += next.interval;
                else
                    timers.delete(next.id);
                ran++;
                try {
                    if (next.kind === "frame")
                        next.callback(next.frameTime);
                    else
                        next.callback(...next.args);
                }
                catch (error) {
                    errorHandler(error);
                }
            }
        }
        finally {
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
            return schedule("frame", handler, 0, false, []);
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
export function hostScheduler() {
    const hook = globalValue("__qchatTimerScheduler");
    if (hook &&
        typeof hook.wake === "function" &&
        typeof hook.now === "function") {
        return hook;
    }
    return {
        wake(delayMs) {
            // A negative delay tells the host that no timer is pending. Sending a
            // frame must never crash the app, and host() already guards that.
            host().send("timer", { delayMs });
        },
        now: () => {
            const date = globalValue("Date");
            return date && typeof date.now === "function" ? date.now() : 0;
        },
    };
}
/** The queue the installed globals use; also the tick entry point. */
export function createHostTimerQueue(scheduler) {
    const queue = createTimerQueue(scheduler ?? hostScheduler());
    queue.onError((error) => {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error && error.stack ? error.stack : undefined;
        host().send("log", { level: "error", message, stack });
    });
    return queue;
}
let installed = null;
/** The queue installed by `installTimers()`, if any. */
export function installedTimerQueue() {
    return installed;
}
export function installTimers(queue) {
    queue ??= createHostTimerQueue();
    if (installed)
        return installed;
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
    installGlobal("__qchatTickTimers", () => (nowMs) => queue.tick(nowMs), {
        force: true,
    });
    installGlobal("__qchatTimerPending", () => () => queue.pending(), { force: true });
    installGlobal("__qchatTimerClearAll", () => () => queue.clearAll(), { force: true });
    return installed;
}
//# sourceMappingURL=timers.js.map