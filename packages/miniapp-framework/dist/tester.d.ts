import type { RenderNode, SerializedTree } from "./protocol.js";
export interface HarnessOptions {
    appId?: string;
    timeoutMs?: number;
    /** Extra host responses, keyed by method. */
    responses?: Record<string, (params: Record<string, unknown>) => unknown>;
    /** Virtual clock start; the harness owns time, negative values are clamped. */
    now?: number;
}
/**
 * The host clock the harness exposes to the app. The bundle keeps the timer
 * queue and the harness owns the time, so timer tests are deterministic: no
 * real waiting and no flaky ordering.
 */
export interface HarnessTimers {
    /** Current virtual time in milliseconds. */
    now(): number;
    /** Moves the clock forward and runs everything that is due. */
    advance(milliseconds: number): number;
    /** Number of timers the app still has scheduled. */
    pending(): number;
    /** Delay the app last asked the host to wait for, or `null` when idle. */
    nextDelay(): number | null;
}
export interface HarnessLog {
    level: string;
    message: string;
    stack?: string;
}
export interface HarnessResult {
    tree: SerializedTree | null;
    renders: SerializedTree[];
    calls: Array<{
        method: string;
        params: Record<string, unknown>;
    }>;
    logs: HarnessLog[];
    timers: HarnessTimers;
    dispatch(id: string, event: string, payload?: unknown): SerializedTree | null;
    latest(): SerializedTree | null;
    dispose(): void;
}
/** Execute a compiled `app.js` bundle with a deterministic QChat host. */
export declare function runBundle(appJs: string, options?: HarnessOptions): HarnessResult;
export declare function runQapp(bytes: Buffer, options?: HarnessOptions): HarnessResult;
export declare function walkTree(tree: SerializedTree | null, visit: (node: RenderNode) => void): void;
export declare function findNode(tree: SerializedTree | null, predicate: (node: RenderNode) => boolean): RenderNode | null;
export declare function textContent(tree: SerializedTree | null): string;
export declare function pressFirst(harness: HarnessResult, label?: string): SerializedTree | null;
export { readZip } from "./zip.js";
//# sourceMappingURL=tester.d.ts.map