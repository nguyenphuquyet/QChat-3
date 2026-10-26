import { emit, host } from "./host.js";
import { FRAGMENT_TYPE, HOST_NODE_TYPES, PROP_EVENT_MAP, TEXT_NODE_TYPE, } from "./ui-contract.generated.js";
import { PROTOCOL_VERSION, QChatError, SDK_VERSION, } from "./protocol.js";
export const Fragment = FRAGMENT_TYPE;
function isVNode(value) {
    return (typeof value === "object" &&
        value !== null &&
        "type" in value &&
        "props" in value);
}
export function h(type, props, ...children) {
    const next = { ...(props ?? {}) };
    if (children.length === 1)
        next.children = children[0];
    else if (children.length > 1)
        next.children = children;
    const key = next.key;
    // `key` and `ref` are element attributes, not host props.
    delete next.key;
    delete next.ref;
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
let instances = new Map();
let rootComponent = null;
let appId = "mp_unknown";
let currentInstance = null;
let cursor = 0;
let visited = new Set();
let revision = 0;
let lastTree = null;
let rendering = false;
let batching = 0;
let dirty = false;
let disposed = false;
let pendingLayout = [];
let pendingPassive = [];
let pendingCleanups = [];
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
function activeInstance() {
    if (!currentInstance) {
        throw new QChatError("HOOK_OUTSIDE_COMPONENT", "Hooks can only be called inside a component");
    }
    return currentInstance;
}
function nextSlot(kind, create) {
    const instance = activeInstance();
    const index = cursor++;
    const existing = instance.slots[index];
    if (existing && existing.kind === kind)
        return existing;
    if (existing && existing.kind === "effect" && typeof existing.cleanup === "function") {
        const cleanup = existing.cleanup;
        pendingCleanups.push(() => cleanup());
    }
    const created = create();
    instance.slots[index] = created;
    return created;
}
export function useState(initial) {
    const slot = nextSlot("state", () => {
        const created = {
            kind: "state",
            value: typeof initial === "function" ? initial() : initial,
            setter: (next) => {
                const value = typeof next === "function"
                    ? next(created.value)
                    : next;
                if (Object.is(created.value, value))
                    return;
                created.value = value;
                scheduleRender();
            },
        };
        return created;
    });
    // The setter identity stays stable across renders, like React.
    return [slot.value, slot.setter];
}
export function useReducer(reducer, initial) {
    const [state, setState] = useState(initial);
    const dispatch = (action) => {
        setState((previous) => reducer(previous, action));
    };
    return [state, dispatch];
}
export function useRef(initial) {
    const slot = nextSlot("ref", () => ({
        kind: "ref",
        value: { current: initial },
    }));
    return slot.value;
}
export function useMemo(factory, deps) {
    const slot = nextSlot("memo", () => ({
        kind: "memo",
        deps,
        value: factory(),
    }));
    if (!sameDeps(slot.deps, deps)) {
        slot.value = factory();
        slot.deps = deps;
    }
    return slot.value;
}
export function useCallback(callback, deps) {
    return useMemo(() => callback, deps);
}
function useEffectImpl(effect, deps, layout) {
    const slot = nextSlot("effect", () => ({
        kind: "effect",
        deps,
        layout,
        ran: false,
    }));
    const shouldRun = !slot.ran || deps === undefined || !sameDeps(slot.deps, deps);
    if (!shouldRun)
        return;
    slot.ran = true;
    slot.deps = deps;
    slot.layout = layout;
    const task = () => {
        if (typeof slot.cleanup === "function")
            slot.cleanup();
        slot.cleanup = effect();
    };
    if (layout)
        pendingLayout.push(task);
    else
        pendingPassive.push(task);
}
export function useEffect(effect, deps) {
    useEffectImpl(effect, deps, false);
}
/** Same as `useEffect` but runs before the frame is handed to Flutter. */
export function useLayoutEffect(effect, deps) {
    useEffectImpl(effect, deps, true);
}
/** A stable id, unique per component instance and hook position. */
export function useId() {
    const slot = nextSlot("id", () => {
        const instance = activeInstance();
        const index = cursor - 1;
        return { kind: "id", value: `qapp_${sanitizeId(instance.key)}_${index}` };
    });
    return slot.value;
}
function sanitizeId(value) {
    return value.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 64);
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
export function createContext(defaultValue) {
    const context = { defaultValue, value: defaultValue };
    const Provider = (props) => props.children;
    Provider.__qchatContext =
        context;
    const Consumer = (props) => props.children(context.value);
    return Object.assign(context, { Provider, Consumer });
}
export function useContext(context) {
    return context.value;
}
function providerFor(type) {
    if (typeof type !== "function")
        return null;
    const context = type.__qchatContext;
    return context ?? null;
}
function slotName(element, index) {
    return element.key != null ? `#${element.key}` : `@${index}`;
}
function flatten(value, out) {
    if (value == null || typeof value === "boolean")
        return;
    if (Array.isArray(value)) {
        for (const item of value)
            flatten(item, out);
        return;
    }
    out.push(value);
}
/** Map a JSX event prop (for example `onPress`) to its wire event name. */
function eventNameFor(prop) {
    // Only props declared in the contract become events, so an unknown handler is
    // dropped instead of leaking a function into the render frame.
    const event = PROP_EVENT_MAP[prop];
    return event ? event : null;
}
function renderChildren(value, ownerKey) {
    const items = [];
    flatten(value, items);
    const nodes = [];
    let index = 0;
    for (const item of items) {
        if (typeof item === "string" || typeof item === "number") {
            nodes.push({
                type: TEXT_NODE_TYPE,
                props: { text: String(item) },
                events: [],
                children: [],
            });
            index++;
            continue;
        }
        const element = item;
        if (!isVNode(element)) {
            index++;
            continue;
        }
        nodes.push(...renderElement(element, ownerKey, slotName(element, index)));
        index++;
    }
    return nodes;
}
function renderElement(element, ownerKey, slot) {
    const type = element.type;
    if (type === Fragment) {
        return renderChildren(element.props.children, `${ownerKey}/${slot}~`);
    }
    const context = providerFor(type);
    if (context) {
        const provided = element.props.value;
        const previous = context.value;
        context.value = provided === undefined ? context.defaultValue : provided;
        try {
            return renderChildren(element.props.children, `${ownerKey}/${slot}c`);
        }
        finally {
            context.value = previous;
        }
    }
    if (typeof type === "function") {
        return renderComponent(type, element.props, ownerKey, slot);
    }
    if (typeof type !== "string")
        return [];
    assertKnownType(type);
    const node = { type, props: {}, events: [], children: [] };
    for (const [prop, value] of Object.entries(element.props)) {
        if (prop === "children" || prop === "key" || prop === "ref")
            continue;
        if (typeof value === "function") {
            const event = eventNameFor(prop);
            if (event) {
                node.events.push({
                    name: event,
                    handler: value,
                });
            }
            continue;
        }
        if (value === undefined)
            continue;
        node.props[prop] = value;
    }
    node.children = renderChildren(element.props.children, `${ownerKey}/${slot}#`);
    return [node];
}
function renderComponent(component, props, ownerKey, slot) {
    const key = `${ownerKey}/${slot}`;
    let instance = instances.get(key);
    if (!instance || instance.component !== component) {
        instance = { key, component, slots: [] };
        instances.set(key, instance);
    }
    visited.add(key);
    const previousInstance = currentInstance;
    const previousCursor = cursor;
    currentInstance = instance;
    cursor = 0;
    let output = null;
    try {
        output = component(props);
    }
    catch (error) {
        reportError(error);
    }
    // Drop hooks a conditional render did not call and release their effects.
    for (let index = cursor; index < instance.slots.length; index++) {
        const removed = instance.slots[index];
        if (removed.kind === "effect" && typeof removed.cleanup === "function") {
            const cleanup = removed.cleanup;
            pendingCleanups.push(() => cleanup());
        }
    }
    instance.slots.length = cursor;
    currentInstance = previousInstance;
    cursor = previousCursor;
    return renderChildren(output, key);
}
function serialize(node, id) {
    const props = { ...node.props };
    const children = node.children.map((child, index) => serialize(child, `${id}.${index}`));
    const events = [];
    for (const entry of node.events) {
        events.push(entry.name);
        handlers.set(`${id}:${entry.name}`, entry.handler);
    }
    if (events.length)
        props.__events = events;
    const result = { id, type: node.type, props };
    if (events.length)
        result.events = events;
    if (children.length)
        result.children = children;
    return result;
}
function safe(task) {
    try {
        task();
    }
    catch (error) {
        reportError(error);
    }
}
function renderNow() {
    if (disposed || !rootComponent)
        return;
    if (rendering) {
        dirty = true;
        return;
    }
    rendering = true;
    try {
        visited = new Set();
        handlers.clear();
        pendingLayout = [];
        pendingPassive = [];
        pendingCleanups = [];
        const hostRoots = renderComponent(rootComponent, { children: [] }, "", "root");
        const root = hostRoots.length === 0
            ? null
            : hostRoots.length === 1
                ? serialize(hostRoots[0], "n0")
                : serialize({ type: "View", props: {}, events: [], children: hostRoots }, "n0");
        revision += 1;
        const tree = { v: PROTOCOL_VERSION, appId, root, revision };
        lastTree = tree;
        // Unmount instances that were not touched by this pass.
        for (const [key, instance] of instances) {
            if (visited.has(key))
                continue;
            for (const slot of instance.slots) {
                if (slot.kind === "effect" && typeof slot.cleanup === "function") {
                    const cleanup = slot.cleanup;
                    pendingCleanups.push(() => cleanup());
                }
            }
            instances.delete(key);
        }
        for (const cleanup of pendingCleanups)
            safe(cleanup);
        for (const task of pendingLayout)
            safe(task);
        host().send("render", tree);
    }
    catch (error) {
        reportError(error);
    }
    finally {
        rendering = false;
    }
    batching++;
    try {
        for (const task of pendingPassive)
            safe(task);
    }
    finally {
        batching--;
    }
    pendingCleanups = [];
    pendingLayout = [];
    pendingPassive = [];
    if (dirty) {
        dirty = false;
        renderNow();
    }
}
export function scheduleRender() {
    if (disposed)
        return;
    if (rendering || batching > 0) {
        dirty = true;
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
    instances = new Map();
    visited = new Set();
    currentInstance = null;
    cursor = 0;
    handlers.clear();
    lifecycleHandlers.clear();
    revision = 0;
    dirty = false;
    batching = 0;
    installGlobals();
    emit("ready", { sdkVersion: SDK_VERSION });
    renderNow();
}
export function dispose() {
    disposed = true;
    for (const instance of instances.values()) {
        for (const slot of instance.slots) {
            if (slot.kind === "effect" && typeof slot.cleanup === "function") {
                try {
                    slot.cleanup();
                }
                catch (error) {
                    reportError(error);
                }
            }
        }
    }
    instances = new Map();
    handlers.clear();
    lifecycleHandlers.clear();
    lastTree = null;
    delete globalThis.__qchatDispatch;
    delete globalThis.__qchatLifecycle;
}
/** Test/dev helper: returns the latest rendered tree. */
export function getRenderTree() {
    return lastTree;
}
export function dispatchEvent(id, event, payload) {
    const handler = handlers.get(`${id}:${event}`);
    if (!handler)
        return;
    batching++;
    try {
        handler(payload);
    }
    catch (error) {
        reportError(error);
    }
    finally {
        batching--;
    }
    // Every setState from this one event collapses into a single frame.
    if (dirty) {
        dirty = false;
        renderNow();
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
/** Node types the host understands, generated from the UI contract. */
export const hostNodeTypes = HOST_NODE_TYPES;
export function assertKnownType(type) {
    if (type === TEXT_NODE_TYPE || hostNodeTypes.has(type))
        return;
    throw new QChatError("UNSUPPORTED_COMPONENT", `Unsupported component ${type}`);
}
//# sourceMappingURL=runtime.js.map