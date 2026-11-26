import { callHost } from "./host.js";
/**
 * The QuickJS bridge has no cancel channel, so an abort stops the promise in
 * the app while the host may still finish its own work. Create the signal with
 * the `AbortController` from `@mna/qchat/env` and pass it as `signal`.
 */
function abortError(reason) {
    const error = new Error(reason === undefined ? "The operation was aborted" : String(reason));
    error.name = "AbortError";
    return error;
}
function withSignal(signal, run) {
    if (!signal)
        return run();
    if (signal.aborted)
        return Promise.reject(abortError(signal.reason));
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(abortError(signal.reason));
        signal.addEventListener("abort", onAbort);
        run().then((value) => {
            signal.removeEventListener("abort", onAbort);
            resolve(value);
        }, (error) => {
            signal.removeEventListener("abort", onAbort);
            reject(error);
        });
    });
}
/**
 * Read-only QChat API call. Only `/users/me`, `/friends` and `/conversations`
 * are available, and each requires its declared permission.
 */
export function request(path, options = {}) {
    return withSignal(options.signal, () => callHost("request", {
        path,
        method: options.method ?? "GET",
        query: options.query,
        body: options.body,
        headers: options.headers,
    }));
}
/**
 * HTTPS request through the host. Requires the `network` permission. Any HTTPS
 * host is reachable: there is no per-app host allowlist, so the manifest does
 * not declare one. The host still validates the URL, the permission and the
 * response size; the JavaScript side cannot bypass any of that.
 */
export function fetch(url, options = {}) {
    return withSignal(options.signal, () => callHost("fetch", {
        url,
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body,
        timeoutMs: options.timeoutMs,
    }));
}
export async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    return response.data;
}
//# sourceMappingURL=network.js.map