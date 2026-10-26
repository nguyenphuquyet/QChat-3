import { createContext, runInContext } from "node:vm";
import { readZip } from "./zip.js";
import { validateQapp } from "./compiler.js";
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
/** Execute a compiled `app.js` bundle with a deterministic QChat host. */
export function runBundle(appJs, options = {}) {
    const renders = [];
    const calls = [];
    const logs = [];
    let current = null;
    let treeAtDispatch = null;
    let closed = false;
    let virtualNow = options.now ?? Date.UTC(2026, 0, 1, 12, 0, 0);
    let wakeRequest = null;
    const scheduler = {
        now: () => virtualNow,
        wake(delayMs) {
            wakeRequest = delayMs < 0 ? null : delayMs;
        },
    };
    const defaults = {
        getAppInfo: () => ({
            appId: options.appId ?? "mp_test",
            name: "Test Mini App",
            version: "1.0.0",
            runtimeVersion: "1.0.0",
            minRuntimeVersion: "1.0.0",
            permissions: [],
        }),
        getSystemInfo: () => ({
            platform: "test",
            theme: "light",
            locale: "vi",
            screenWidth: 390,
            screenHeight: 844,
            pixelRatio: 1,
        }),
        getUserInfo: () => ({
            id: "user-1",
            qchatId: "qchat-1",
            nickname: "Test User",
            avatarUrl: null,
        }),
        getStorage: (params) => ({ value: storage.get(String(params.key)) ?? null }),
        setStorage: (params) => {
            storage.set(String(params.key), params.value);
            return null;
        },
        removeStorage: (params) => {
            storage.delete(String(params.key));
            return null;
        },
        showToast: () => null,
        share: () => ({ shared: true }),
        navigateTo: () => null,
        navigateBack: () => null,
        closeMiniApp: () => {
            closed = true;
            return null;
        },
        request: (params) => ({ path: params.path, items: [] }),
        fetch: (params) => ({ status: 200, headers: {}, data: { url: params.url } }),
        chooseImage: () => ({
            dataUrl: "data:image/png;base64,iVBORw0KGgo=",
            mimeType: "image/png",
            width: 1,
            height: 1,
            size: 8,
        }),
    };
    const storage = new Map();
    const native = {
        send(kind, payload) {
            if (kind === "timer") {
                // The app only takes this path when no scheduler hook is available.
                const delay = payload?.delayMs;
                wakeRequest = typeof delay === "number" && delay >= 0 ? delay : null;
                return;
            }
            if (closed)
                return;
            if (kind === "render") {
                current = clone(payload);
                renders.push(current);
            }
            if (kind === "log") {
                const entry = payload;
                const record = {
                    level: entry.level ?? "info",
                    message: entry.message ?? "",
                };
                if (entry.stack)
                    record.stack = entry.stack;
                logs.push(record);
            }
        },
        async call(method, params) {
            const normalized = (params ?? {});
            calls.push({ method, params: clone(normalized) });
            const handler = options.responses?.[method] ?? defaults[method];
            if (!handler) {
                return {
                    ok: false,
                    error: { code: "NOT_SUPPORTED", message: `No test response for ${method}` },
                };
            }
            try {
                const result = await handler(normalized);
                return { ok: true, result };
            }
            catch (error) {
                return {
                    ok: false,
                    error: {
                        code: error.code ?? "HOST_ERROR",
                        message: error instanceof Error ? error.message : String(error),
                    },
                };
            }
        },
    };
    // A fresh V8 context already carries the ECMAScript built-ins, which is
    // exactly what QuickJS gives a bundle. Everything QuickJS lacks is left
    // undefined on purpose, so a bundle that uses `console`, `setTimeout`, `Intl`
    // or `URL` without installing `@mna/qchat/env` fails here the same way it
    // would fail on a device.
    const sandbox = {
        __qchatNative: native,
        __qchatTimerScheduler: scheduler,
        console: undefined,
        setTimeout: undefined,
        clearTimeout: undefined,
        setInterval: undefined,
        clearInterval: undefined,
        requestAnimationFrame: undefined,
        cancelAnimationFrame: undefined,
        queueMicrotask: undefined,
        structuredClone: undefined,
        URL: undefined,
        URLSearchParams: undefined,
        TextEncoder: undefined,
        TextDecoder: undefined,
        AbortController: undefined,
        AbortSignal: undefined,
        Intl: undefined,
    };
    const context = createContext(sandbox);
    runInContext(appJs, context, {
        filename: "app.js",
        timeout: options.timeoutMs ?? 5_000,
    });
    const tickTimers = (now) => {
        const tick = sandbox.__qchatTickTimers;
        return typeof tick === "function" ? tick(now) : 0;
    };
    const timers = {
        now: () => virtualNow,
        advance(milliseconds) {
            // One advance is one host wake, which is one tick: exactly what the
            // Flutter host does when the app asks to be woken again.
            virtualNow += Math.max(0, milliseconds);
            return tickTimers(virtualNow);
        },
        pending() {
            const probe = sandbox.__qchatTimerPending;
            return typeof probe === "function" ? probe() : 0;
        },
        nextDelay: () => wakeRequest,
    };
    const dispatch = (id, event, payload) => {
        treeAtDispatch = current;
        const fn = sandbox.__qchatDispatch;
        if (!fn)
            return null;
        fn(id, event, payload);
        return current;
    };
    return {
        tree: current,
        renders,
        calls,
        logs,
        timers,
        dispatch,
        latest: () => current,
        dispose: () => {
            const fn = sandbox.__qchatLifecycle;
            fn?.("destroy");
            const clearAll = sandbox.__qchatTimerClearAll;
            if (typeof clearAll === "function")
                clearAll();
            closed = true;
        },
    };
}
export function runQapp(bytes, options = {}) {
    validateQapp(bytes);
    const entries = readZip(bytes);
    const appEntry = entries.find((entry) => entry.name === "app.js");
    if (!appEntry)
        throw new Error("ENTRY_MISSING");
    return runBundle(appEntry.bytes.toString("utf8"), options);
}
export function walkTree(tree, visit) {
    if (!tree?.root)
        return;
    const walk = (node) => {
        visit(node);
        for (const child of node.children ?? [])
            walk(child);
    };
    walk(tree.root);
}
export function findNode(tree, predicate) {
    let found = null;
    walkTree(tree, (node) => {
        if (!found && predicate(node))
            found = node;
    });
    return found;
}
export function textContent(tree) {
    const parts = [];
    walkTree(tree, (node) => {
        if (node.type === "#text")
            parts.push(String(node.props.text ?? ""));
    });
    return parts.join("");
}
export function pressFirst(harness, label) {
    const button = findNode(harness.latest(), (node) => {
        if (node.type !== "Button" && node.type !== "Pressable")
            return false;
        if (!label)
            return true;
        return textContent({ ...harness.latest(), root: node }).includes(label);
    });
    if (!button)
        throw new Error("BUTTON_NOT_FOUND");
    return harness.dispatch(button.id, "press", {});
}
export { readZip } from "./zip.js";
//# sourceMappingURL=tester.js.map