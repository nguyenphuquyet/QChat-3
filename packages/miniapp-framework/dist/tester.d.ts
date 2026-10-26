import type { RenderNode, SerializedTree } from "./protocol.js";
export interface HarnessOptions {
    appId?: string;
    timeoutMs?: number;
    /** Extra host responses, keyed by method. */
    responses?: Record<string, (params: Record<string, unknown>) => unknown>;
}
export interface HarnessResult {
    tree: SerializedTree | null;
    renders: SerializedTree[];
    calls: Array<{
        method: string;
        params: Record<string, unknown>;
    }>;
    logs: Array<{
        level: string;
        message: string;
    }>;
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