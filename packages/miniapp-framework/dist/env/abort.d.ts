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
export declare function createAbortError(reason?: QappAbortReason): Error;
export declare class QappAbortSignal implements QappAbortSignalLike {
    aborted: boolean;
    reason: QappAbortReason;
    onabort: ((event: QappAbortEvent) => void) | null;
    private listeners;
    addEventListener(_type: "abort", listener: (event: QappAbortEvent) => void): void;
    removeEventListener(_type: "abort", listener: (event: QappAbortEvent) => void): void;
    /** Internal: mark the signal aborted and notify listeners once. */
    dispatch(reason?: QappAbortReason): void;
    throwIfAborted(): void;
    static abort(reason?: QappAbortReason): QappAbortSignal;
    /** Needs the timers installed; `setTimeout` is what fires the abort. */
    static timeout(milliseconds: number): QappAbortSignal;
}
export declare class QappAbortController {
    readonly signal: QappAbortSignal;
    constructor();
    abort(reason?: QappAbortReason): void;
}
export declare function installAbort(): void;
/** True while the signal is already aborted, used before a host call. */
export declare function assertNotAborted(signal?: QappAbortSignalLike | null): void;
//# sourceMappingURL=abort.d.ts.map