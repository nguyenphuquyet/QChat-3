import { type HostBridge, type HostResponse } from "./protocol.js";
interface NativeHost {
    send(kind: string, payload: unknown): void;
    call(method: string, params: unknown): Promise<HostResponse> | HostResponse;
}
interface TestHost extends NativeHost {
    calls: Array<{
        method: string;
        params: Record<string, unknown>;
    }>;
    events: Array<{
        kind: string;
        payload: unknown;
    }>;
    renders: unknown[];
}
declare global {
    var __qchatNative: NativeHost | undefined;
    var __qchatTestHost: TestHost | undefined;
    var __qchatDispatch: ((id: string, event: string, payload?: unknown) => void) | undefined;
    var __qchatLifecycle: ((event: string, payload?: unknown) => void) | undefined;
}
export declare function host(): HostBridge;
/** Used only by tests and the dev harness. */
export declare function setHostForTesting(value: HostBridge | null): void;
export declare function callHost<T = unknown>(method: Parameters<HostBridge["call"]>[0], params?: Record<string, unknown>): Promise<T>;
export declare function emit(kind: "ready" | "log" | "lifecycle", payload: unknown): void;
export {};
//# sourceMappingURL=host.d.ts.map