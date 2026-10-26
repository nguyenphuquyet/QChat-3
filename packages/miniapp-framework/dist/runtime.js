import { emit, host } from "./host.js";
import { PROTOCOL_VERSION, QChatError, SDK_VERSION, } from "./protocol.js";
export const Fragment = "#fragment";
function isVNode(value) {
    return (typeof value === "object" &&
        value !== null &&
        "type" in value &&
        "props" in value &&
        "children" in value);
}
export function h(type, props, ...children) {
    const next = { ...(props ?? {}) };
    if (children.length === 1)
        next.children = children[0];
    else if (children.length > 1)
        next.children = children;
    const key = next.key;
    delete next.key;
    return {
        type,
        props: next,
        children: children,
        key: key == null ? undefined : String(key),
    };
}
/** Create a host node without children. Used by the UI components. */
export function node(type, props = {}) {
    return h(type, props);
}
let slots = [];
let cursor = 0;
let rendering = false;
let revision = 0;
let rootComponent = null;
let appId = "mp_unknown";
let scheduled = false;
let disposed = false;
let lastTree = null;
let pendingEffects = [];
const handlers = new Map();
const lifecycleHandlers = new Set();
function sameDeps(a, b) {
    if (!a || !b || a.length !== b.length)
        return false;
    for (let index = 0; index < a.length; index++) {
        if (!Object.is(a[index], b[index]))
            return false;
    }
    return true;
}
export function useState(initial) {
    const index = cursor++;
    let slot = slots[index];
    if (!slot || slot.kind !== "state") {
        const value = typeof initial === "function" ? initial() : initial;
        const stateSlot = {
            kind: "state",
            value,
            setter: (next) => {
                stateSlot.value = next;
                scheduleRender();
            },
        };
        slots[index] = stateSlot;
        slot = stateSlot;
    }
    const state = slot;
    const setter = (next) => {
        const value = typeof next === "function"
            ? next(state.value)
            : next;
        state.setter(value);
    };
    return [state.value, setter];
}
export function useReducer(reducer, initial) {
    const [state, setState] = useState(initial);
    const dispatch = (action) => {
        setState((previous) => reducer(previous, action));
    };
    return [state, dispatch];
}
export function useRef(initial) {
    const index = cursor++;
    let slot = slots[index];
    if (!slot || slot.kind !== "ref") {
        const refSlot = { kind: "ref", value: { current: initial } };
        slots[index] = refSlot;
        slot = refSlot;
    }
    return slot.value;
}
export function useMemo(factory, deps) {
    const index = cursor++;
    let slot = slots[index];
    if (!slot || slot.kind !== "memo") {
        const memoSlot = { kind: "memo", deps, value: factory() };
        slots[index] = memoSlot;
        return memoSlot.value;
    }
    const memo = slot;
    if (!sameDeps(memo.deps, deps)) {
        memo.value = factory();
        memo.deps = deps;
    }
    return memo.value;
}
export function useCallback(callback, deps) {
    return useMemo(() => callback, deps);
}
export function useEffect(effect, deps) {
    const index = cursor++;
    let slot = slots[index];
    if (!slot || slot.kind !== "effect") {
        const effectSlot = { kind: "effect", deps, run: true };
        slots[index] = effectSlot;
        slot = effectSlot;
    }
    const current = slot;
    if (current.run || !sameDeps(current.deps, deps)) {
        current.deps = deps;
        current.run = false;
        pendingEffects.push(() => {
            if (typeof current.cleanup === "function")
                current.cleanup();
            current.cleanup = effect();
        });
    }
}
/** Attach a lifecycle listener for `resume`, `pause` or `destroy`. */
export function useLifecycle(listener) {
    const ref = useRef(listener);
    ref.current = listener;
    useEffect(() => {
        const handler = (event, payload) => ref.current(event, payload);
        lifecycleHandlers.add(handler);
        return () => {
            lifecycleHandlers.delete(handler);
        };
    }, []);
}
function resetCursor() {
    cursor = 0;
}
/* -------------------------------------------------------------------------- */
/* Serialization                                                              */
/* -------------------------------------------------------------------------- */
function normalizeChild(child) {
    if (child == null || typeof child === "boolean")
        return [];
    if (Array.isArray(child)) {
        const out = [];
        for (const item of child)
            out.push(...normalizeChild(item));
        return out;
    }
    if (typeof child === "string" || typeof child === "number") {
        return [
            {
                type: "#text",
                props: { text: String(child) },
                children: [],
            },
        ];
    }
    if (!isVNode(child))
        return [];
    if (child.type === Fragment) {
        const fragmentChildren = child.props.children;
        return normalizeChild(fragmentChildren);
    }
    if (typeof child.type === "function") {
        const rendered = child.type(child.props);
        return normalizeChild(rendered);
    }
    const children = normalizeChild(child.props.children ?? child.children);
    return [
        {
            ...child,
            props: { ...child.props, children },
            children,
        },
    ];
}
function eventNameFor(prop) {
    if (!prop.startsWith("on") || prop.length < 3)
        return null;
    const raw = prop.slice(2);
    if (raw === "Press")
        return "press";
    if (raw === "LongPress")
        return "longPress";
    if (raw === "Change")
        return "change";
    if (raw === "CheckedChange")
        return "change";
    if (raw === "Input")
        return "input";
    if (raw === "Submit")
        return "submit";
    if (raw === "ValueChange")
        return "valueChange";
    if (raw === "Scroll")
        return "scroll";
    if (raw === "Refresh")
        return "refresh";
    if (raw === "Focus")
        return "focus";
    if (raw === "Blur")
        return "blur";
    if (raw === "Select")
        return "select";
    return null;
}
function serialize(vnode, path, parent) {
    const id = path;
    if (vnode.type === "#text") {
        return { id, type: "#text", props: { text: String(vnode.props.text ?? "") } };
    }
    if (vnode.type === "#fragment")
        return null;
    const props = {};
    const events = [];
    for (const [key, value] of Object.entries(vnode.props)) {
        if (key === "children" || key === "key")
            continue;
        if (typeof value === "function") {
            const event = eventNameFor(key);
            if (event) {
                events.push(event);
                handlers.set(`${id}:${event}`, value);
            }
            continue;
        }
        if (value === undefined)
            continue;
        props[key] = value;
    }
    const children = [];
    const rawChildren = normalizeChild(vnode.props.children ?? vnode.children);
    rawChildren.forEach((child, index) => {
        const serialized = serialize(child, `${id}.${index}`, null);
        if (serialized)
            children.push(serialized);
    });
    if (events.length)
        props.__events = events;
    const node = { id, type: vnode.type, props };
    if (events.length)
        node.events = events;
    if (children.length)
        node.children = children;
    return node;
}
function renderNow() {
    if (disposed || !rootComponent)
        return;
    if (rendering) {
        scheduled = true;
        return;
    }
    rendering = true;
    try {
        resetCursor();
        handlers.clear();
        pendingEffects = [];
        const vnode = normalizeChild(rootComponent({ children: [] }))[0];
        const root = vnode ? serialize(vnode, "n0", null) : null;
        revision += 1;
        const tree = {
            v: PROTOCOL_VERSION,
            appId,
            root,
            revision,
        };
        lastTree = tree;
        host().send("render", tree);
        const effects = pendingEffects;
        pendingEffects = [];
        for (const effect of effects) {
            try {
                effect();
            }
            catch (error) {
                reportError(error);
            }
        }
    }
    catch (error) {
        reportError(error);
    }
    finally {
        rendering = false;
        if (scheduled) {
            scheduled = false;
            renderNow();
        }
    }
}
export function scheduleRender() {
    if (disposed)
        return;
    if (rendering) {
        scheduled = true;
        return;
    }
    renderNow();
}
function reportError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? error.stack : "";
    host().send("log", { level: "error", message, stack });
}
/** Start the mini app and emit the first render frame. */
export function start(component, options = {}) {
    rootComponent = component;
    appId = options.appId ?? "mp_unknown";
    disposed = false;
    slots = [];
    handlers.clear();
    lifecycleHandlers.clear();
    revision = 0;
    installGlobals();
    emit("ready", { sdkVersion: SDK_VERSION });
    renderNow();
}
export function dispose() {
    disposed = true;
    for (const slot of slots) {
        if (slot.kind === "effect" && typeof slot.cleanup === "function") {
            slot.cleanup();
        }
    }
    slots = [];
    handlers.clear();
    lifecycleHandlers.clear();
    lastTree = null;
    delete globalThis.__qchatDispatch;
    delete globalThis.__qchatLifecycle;
}
/** Test/dev helper: forces a rerender and returns the latest tree. */
export function getRenderTree() {
    return lastTree;
}
export function dispatchEvent(id, event, payload) {
    const handler = handlers.get(`${id}:${event}`);
    if (!handler)
        return;
    try {
        handler(payload);
    }
    catch (error) {
        reportError(error);
    }
}
function installGlobals() {
    globalThis.__qchatDispatch = (id, event, payload) => {
        dispatchEvent(id, event, payload);
    };
    globalThis.__qchatLifecycle = (event, payload) => {
        for (const listener of lifecycleHandlers) {
            try {
                listener(event, payload);
            }
            catch (error) {
                reportError(error);
            }
        }
    };
}
/** Validate that a host-supplied tree only contains supported node types. */
export const hostNodeTypes = new Set([
    "View",
    "Text",
    "Image",
    "Icon",
    "Row",
    "Column",
    "Stack",
    "Positioned",
    "ScrollView",
    "ListView",
    "GridView",
    "Button",
    "TextField",
    "Checkbox",
    "Switch",
    "Slider",
    "Spacer",
    "Divider",
    "ActivityIndicator",
    "SafeArea",
    "Pressable",
    "AnimatedView",
    "CustomPaint",
]);
export function assertKnownType(type) {
    if (type === "#text" || hostNodeTypes.has(type))
        return;
    throw new QChatError("UNSUPPORTED_COMPONENT", `Unsupported component ${type}`);
}
//# sourceMappingURL=runtime.js.map