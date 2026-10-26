import { callHost } from "./host.js";
/**
 * Read-only QChat API call. Only `/users/me`, `/friends` and `/conversations`
 * are available, and each requires its declared permission.
 */
export function request(path, options = {}) {
    return callHost("request", {
        path,
        method: options.method ?? "GET",
        query: options.query,
        body: options.body,
        headers: options.headers,
    });
}
/**
 * HTTPS request through the host. Requires the `network` permission and the
 * target host must be declared in `networkDomains` in the manifest. The host
 * enforces the allowlist; the JavaScript side cannot bypass it.
 */
export function fetch(url, options = {}) {
    return callHost("fetch", {
        url,
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body,
        timeoutMs: options.timeoutMs,
    });
}
export async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    return response.data;
}
//# sourceMappingURL=network.js.map