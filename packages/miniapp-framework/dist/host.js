import { QChatError, } from "./protocol.js";
function createTestHost() {
    return {
        calls: [],
        events: [],
        renders: [],
        send(kind, payload) {
            this.events.push({ kind, payload });
            if (kind === "render")
                this.renders.push(payload);
        },
        call(method, params) {
            this.calls.push({
                method,
                params: (params ?? {}),
            });
            switch (method) {
                case "getAppInfo":
                    return {
                        ok: true,
                        result: {
                            appId: "mp_test",
                            name: "Test Mini App",
                            version: "1.0.0",
                            runtimeVersion: "1.0.0",
                            minRuntimeVersion: "1.0.0",
                        },
                    };
                case "getSystemInfo":
                    return {
                        ok: true,
                        result: {
                            platform: "test",
                            theme: "light",
                            locale: "vi",
                            screenWidth: 390,
                            screenHeight: 844,
                            pixelRatio: 1,
                        },
                    };
                default:
                    return {
                        ok: false,
                        error: { code: "NOT_SUPPORTED", message: `Test host has no ${method}` },
                    };
            }
        },
    };
}
function nativeBridge() {
    // `"process" in globalThis` instead of `typeof process`: the SDK source is
    // also what a freshly created project type-checks against, and a qapp project
    // has no Node types at all.
    if (!globalThis.__qchatNative && "process" in globalThis) {
        globalThis.__qchatTestHost = globalThis.__qchatTestHost ?? createTestHost();
    }
    if (!globalThis.__qchatNative && globalThis.__qchatTestHost) {
        const host = globalThis.__qchatTestHost;
        globalThis.__qchatNative = {
            send: (kind, payload) => host.send(kind, payload),
            call: (method, params) => host.call(method, params),
        };
    }
    const native = globalThis.__qchatNative;
    if (!native) {
        return {
            send() {
                // Rendering before the host is installed is a no-op. start() emits the
                // first frame only after this bridge exists.
            },
            call: async (method) => {
                throw new QChatError("BRIDGE_UNAVAILABLE", `QChat host is not available (${method})`);
            },
        };
    }
    return {
        send(kind, payload) {
            try {
                native.send(kind, payload);
            }
            catch {
                // Sending a frame must never crash the mini app.
            }
        },
        async call(method, params) {
            const response = await Promise.resolve(native.call(method, params));
            if (!response || typeof response !== "object") {
                throw new QChatError("HOST_ERROR", "Invalid host response");
            }
            if (response.ok === false) {
                throw new QChatError(response.error?.code ?? "HOST_ERROR", response.error?.message ?? "The QChat host rejected the call");
            }
            return response;
        },
    };
}
let current = null;
export function host() {
    current ??= nativeBridge();
    return current;
}
/** Used only by tests and the dev harness. */
export function setHostForTesting(value) {
    current = value;
}
export async function callHost(method, params = {}) {
    const response = await host().call(method, params);
    return response.result;
}
export function emit(kind, payload) {
    host().send(kind, payload);
}
//# sourceMappingURL=host.js.map