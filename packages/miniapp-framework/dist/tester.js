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
            if (closed)
                return;
            if (kind === "render") {
                current = clone(payload);
                renders.push(current);
            }
            if (kind === "log") {
                const entry = payload;
                logs.push({ level: entry.level ?? "info", message: entry.message ?? "" });
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
    const sandbox = {
        __qchatNative: native,
        console: {
            log: (...args) => logs.push({ level: "info", message: args.join(" ") }),
            warn: (...args) => logs.push({ level: "warn", message: args.join(" ") }),
            error: (...args) => logs.push({ level: "error", message: args.join(" ") }),
        },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        queueMicrotask,
        Promise,
        JSON,
        Math,
        Date,
        Object,
        Array,
        String,
        Number,
        Boolean,
        Error,
        TypeError,
        RegExp,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Symbol,
        Intl,
    };
    const context = createContext(sandbox);
    runInContext(appJs, context, {
        filename: "app.js",
        timeout: options.timeoutMs ?? 5_000,
    });
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
        dispatch,
        latest: () => current,
        dispose: () => {
            const fn = sandbox.__qchatLifecycle;
            fn?.("destroy");
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