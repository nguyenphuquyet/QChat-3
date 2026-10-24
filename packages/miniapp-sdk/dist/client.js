import { QChatError } from "./errors";
/// Paths the host allows through `QChat.request`. Keep this list in sync with
/// `packages/contracts/miniapps.ts`; the host rejects anything else even if a
/// caller bypasses the SDK.
export const MINIAPP_API_ALLOWLIST = [
    "/users/me",
    "/friends",
    "/conversations",
];
const DEFAULT_TIMEOUT = 15_000;
const REQUEST_TIMEOUT = 20_000;
const CHOOSE_IMAGE_TIMEOUT = 60_000;
const MAX_STORAGE_VALUE = 64 * 1024;
const MAX_SHARE_TEXT = 2_000;
function requestId() {
    const crypto = globalThis.crypto;
    if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function assertArgument(condition, message) {
    if (!condition)
        throw new QChatError("INVALID_ARGUMENT", message);
}
function normalizeApiPath(path) {
    const clean = path.split("?")[0].split("#")[0];
    return clean.length > 1 && clean.endsWith("/") ? clean.slice(0, -1) : clean;
}
export class QChatClient {
    pending = new Map();
    transport;
    timeoutMs;
    requestTimeoutMs;
    chooseImageTimeoutMs;
    disposed = false;
    constructor(options = {}) {
        this.transport = options.transport;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
        this.requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT;
        this.chooseImageTimeoutMs =
            options.chooseImageTimeoutMs ?? CHOOSE_IMAGE_TIMEOUT;
        this.installReceiver();
    }
    installReceiver() {
        if (typeof window === "undefined")
            return;
        window.__QChatReceive = (payload) => {
            this.receive(payload);
        };
        window.addEventListener("qchat:message", (event) => {
            const detail = event.detail;
            this.receive(detail);
        });
    }
    /// Resolves one host response. Native code calls
    /// `window.__QChatReceive(JSON.stringify(response))`.
    receive(payload) {
        let response;
        if (typeof payload === "string") {
            try {
                response = JSON.parse(payload);
            }
            catch {
                return false;
            }
        }
        else if (payload && typeof payload === "object") {
            response = payload;
        }
        else {
            return false;
        }
        if (typeof response.id !== "string")
            return false;
        const pending = this.pending.get(response.id);
        if (!pending)
            return false;
        this.pending.delete(response.id);
        clearTimeout(pending.timer);
        if (response.ok) {
            pending.resolve(response.result);
        }
        else {
            const error = response.error ?? { code: "HOST_ERROR" };
            pending.reject(new QChatError(error.code, error.message, error.details));
        }
        return true;
    }
    send(method, params, timeoutMs) {
        if (this.disposed) {
            return Promise.reject(new QChatError("BRIDGE_UNAVAILABLE", "The mini app was closed"));
        }
        const request = { id: requestId(), method, params };
        const transport = this.transport ??
            (() => {
                if (typeof window === "undefined" || !window.QChatNative) {
                    throw new QChatError("BRIDGE_UNAVAILABLE", "QChat host bridge is not available");
                }
                window.QChatNative.postMessage(JSON.stringify(request));
            });
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(request.id);
                reject(new QChatError("TIMEOUT", `${method} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(request.id, {
                resolve: (value) => resolve(value),
                reject,
                timer,
                method,
            });
            try {
                transport(request);
            }
            catch (error) {
                this.pending.delete(request.id);
                clearTimeout(timer);
                reject(error instanceof QChatError
                    ? error
                    : new QChatError("HOST_ERROR", error instanceof Error ? error.message : "Bridge failed"));
            }
        });
    }
    getAppInfo() {
        return this.send("getAppInfo", {}, this.timeoutMs);
    }
    getUserInfo() {
        return this.send("getUserInfo", {}, this.timeoutMs);
    }
    showToast(message, options = {}) {
        assertArgument(typeof message === "string" && message.trim().length > 0, "message is required");
        assertArgument(message.length <= 200, "message is too long");
        return this.send("showToast", { message: message.trim(), ...options }, this.timeoutMs);
    }
    chooseImage(options = {}) {
        return this.send("chooseImage", options, this.chooseImageTimeoutMs);
    }
    share(payload) {
        assertArgument(payload && typeof payload === "object", "payload is required");
        const text = payload.text?.trim() ?? "";
        const url = payload.url?.trim() ?? "";
        assertArgument(text.length > 0 || url.length > 0, "text or url is required");
        assertArgument(text.length <= MAX_SHARE_TEXT, "text is too long");
        assertArgument(url === "" || /^https:\/\/[^\s]+$/i.test(url), "url must be HTTPS");
        return this.send("share", { ...payload, text, url }, this.timeoutMs);
    }
    navigateTo(path) {
        assertArgument(typeof path === "string", "path is required");
        assertArgument(path.startsWith("/") && !path.startsWith("//"), "path must be relative");
        assertArgument(path.length <= 300, "path is too long");
        assertArgument(!path.includes(".."), "path traversal is not allowed");
        assertArgument(!/^[a-z]+:/i.test(path), "absolute URLs are not allowed");
        return this.send("navigateTo", { path }, this.timeoutMs);
    }
    closeMiniApp() {
        return this.send("closeMiniApp", {}, this.timeoutMs);
    }
    request(path, options = {}) {
        assertArgument(typeof path === "string", "path is required");
        assertArgument(path.startsWith("/") && !path.startsWith("//"), "path must be relative");
        assertArgument(!path.includes(".."), "path traversal is not allowed");
        const normalized = normalizeApiPath(path);
        assertArgument(MINIAPP_API_ALLOWLIST.includes(normalized), `path ${normalized} is not allowed`);
        const method = options.method ?? "GET";
        assertArgument(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method), "unsupported method");
        if (options.body !== undefined) {
            try {
                JSON.stringify(options.body);
            }
            catch {
                throw new QChatError("INVALID_ARGUMENT", "body must be JSON serializable");
            }
        }
        return this.send("request", { path: normalized, ...options, method }, this.requestTimeoutMs);
    }
    async getStorage(key) {
        assertArgument(typeof key === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(key), "invalid storage key");
        const result = await this.send("getStorage", { key }, this.timeoutMs);
        return result?.value ?? null;
    }
    async setStorage(key, value) {
        assertArgument(typeof key === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(key), "invalid storage key");
        let encoded;
        try {
            encoded = JSON.stringify(value);
        }
        catch {
            throw new QChatError("INVALID_ARGUMENT", "value must be JSON serializable");
        }
        assertArgument(encoded.length <= MAX_STORAGE_VALUE, "value is larger than 64 KB");
        await this.send("setStorage", { key, value }, this.timeoutMs);
    }
    removeStorage(key) {
        assertArgument(typeof key === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(key), "invalid storage key");
        return this.send("removeStorage", { key }, this.timeoutMs);
    }
    getSystemInfo() {
        return this.send("getSystemInfo", {}, this.timeoutMs);
    }
    /// Rejects every in-flight call. Called when the mini app is closed so no
    /// promise is left hanging in the page.
    dispose(reason = "Mini app closed") {
        this.disposed = true;
        for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new QChatError("CANCELLED", reason));
            this.pending.delete(id);
        }
        if (typeof window !== "undefined" && window.__QChatReceive) {
            delete window.__QChatReceive;
        }
    }
}
/// Default singleton. Import this in Mini App code:
/// `import { QChat } from "@qchat/miniapp-sdk";`
export const QChat = new QChatClient();
export function createQChatClient(options = {}) {
    return new QChatClient(options);
}
//# sourceMappingURL=client.js.map