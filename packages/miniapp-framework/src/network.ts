import { callHost } from "./host.js";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Read-only QChat API call. Only `/users/me`, `/friends` and `/conversations`
 * are available, and each requires its declared permission.
 */
export function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return callHost<T>("request", {
    path,
    method: options.method ?? "GET",
    query: options.query,
    body: options.body,
    headers: options.headers,
  });
}

export interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface FetchResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

/**
 * HTTPS request through the host. Requires the `network` permission and the
 * target host must be declared in `networkDomains` in the manifest. The host
 * enforces the allowlist; the JavaScript side cannot bypass it.
 */
export function fetch<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResponse<T>> {
  return callHost<FetchResponse<T>>("fetch", {
    url,
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body,
    timeoutMs: options.timeoutMs,
  });
}

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const response = await fetch<T>(url, options);
  return response.data;
}
