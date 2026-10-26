import { globalValue } from "./scope.js";
export function createAbortError(reason) {
    const error = new Error(reason === undefined ? "The operation was aborted" : String(reason));
    error.name = "AbortError";
    return error;
}
export class QappAbortSignal {
    aborted = false;
    reason = undefined;
    onabort = null;
    listeners = new Set();
    addEventListener(_type, listener) {
        if (typeof listener === "function")
            this.listeners.add(listener);
    }
    removeEventListener(_type, listener) {
        this.listeners.delete(listener);
    }
    /** Internal: mark the signal aborted and notify listeners once. */
    dispatch(reason) {
        if (this.aborted)
            return;
        this.aborted = true;
        this.reason = reason;
        const event = { type: "abort", target: this };
        const handler = this.onabort;
        const listeners = [...this.listeners];
        this.listeners.clear();
        if (typeof handler === "function") {
            try {
                handler(event);
            }
            catch {
                // A broken listener must not break the abort path.
            }
        }
        for (const listener of listeners) {
            try {
                listener(event);
            }
            catch {
                // Same here.
            }
        }
    }
    throwIfAborted() {
        if (this.aborted)
            throw createAbortError(this.reason);
    }
    static abort(reason) {
        const signal = new QappAbortSignal();
        signal.dispatch(reason === undefined ? createAbortError() : reason);
        return signal;
    }
    /** Needs the timers installed; `setTimeout` is what fires the abort. */
    static timeout(milliseconds) {
        const signal = new QappAbortSignal();
        const timer = globalValue("setTimeout");
        if (typeof timer !== "function") {
            throw new Error("AbortSignal.timeout needs the timers installed (@mna/qchat/env)");
        }
        timer(() => signal.dispatch(createAbortError("The operation timed out")), milliseconds);
        return signal;
    }
}
export class QappAbortController {
    signal;
    constructor() {
        this.signal = new QappAbortSignal();
    }
    abort(reason) {
        this.signal.dispatch(reason === undefined ? createAbortError() : reason);
    }
}
let installed = false;
export function installAbort() {
    if (installed)
        return;
    installed = true;
    const scope = globalThis;
    scope.AbortController = QappAbortController;
    scope.AbortSignal = QappAbortSignal;
}
/** True while the signal is already aborted, used before a host call. */
export function assertNotAborted(signal) {
    if (signal && signal.aborted)
        throw createAbortError(signal.reason);
}
//# sourceMappingURL=abort.js.map