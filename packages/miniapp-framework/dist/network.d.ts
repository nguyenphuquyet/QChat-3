import type { AbortSignalLike } from "./protocol.js";
export interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    query?: Record<string, string | number | boolean>;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignalLike;
}
/**
 * Read-only QChat API call. Only `/users/me`, `/friends` and `/conversations`
 * are available, and each requires its declared permission.
 */
export declare function request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
export interface FetchOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    signal?: AbortSignalLike;
}
export interface FetchResponse<T = unknown> {
    status: number;
    headers: Record<string, string>;
    data: T;
}
/**
 * HTTPS request through the host. Requires the `network` permission. Any HTTPS
 * host is reachable: there is no per-app host allowlist, so the manifest does
 * not declare one. The host still validates the URL, the permission and the
 * response size; the JavaScript side cannot bypass any of that.
 */
export declare function fetch<T = unknown>(url: string, options?: FetchOptions): Promise<FetchResponse<T>>;
export declare function fetchJson<T = unknown>(url: string, options?: FetchOptions): Promise<T>;
//# sourceMappingURL=network.d.ts.map