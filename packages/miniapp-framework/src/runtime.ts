import { emit, host } from "./host.js";
import {
  type BaseProps,
  type EventName,
  type RenderNode,
  type SerializedTree,
  PROTOCOL_VERSION,
  QChatError,
  SDK_VERSION,
} from "./protocol.js";

export type Component<P extends BaseProps = BaseProps> = (props: P) => VNodeChild;

export type VNodeChild =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | VNodeChild[];

export interface VNode {
  type: string | Component<any> | typeof Fragment;
  props: Record<string, unknown>;
  children: VNodeChild[];
  key?: string;
}

export const Fragment = "#fragment" as const;

function isVNode(value: unknown): value is VNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value &&
    "children" in value
  );
}

export function h(
  type: VNode["type"],
  props: Record<string, unknown> | null,
  ...children: VNodeChild[]
): VNode {
  const next = { ...(props ?? {}) };
  if (children.length === 1) next.children = children[0];
  else if (children.length > 1) next.children = children;
  const key = next.key;
  delete next.key;
  return {
    type,
    props: next,
    children: children as VNodeChild[],
    key: key == null ? undefined : String(key),
  };
}

/** Create a host node without children. Used by the UI components. */
export function node(
  type: string,
  props: Record<string, unknown> = {},
): VNode {
  return h(type, props);
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

interface StateSlot {
  kind: "state";
  value: unknown;
  setter: (value: unknown) => void;
}

interface EffectSlot {
  kind: "effect";
  deps?: unknown[];
  cleanup?: void | (() => void);
  run: boolean;
}

interface MemoSlot {
  kind: "memo";
  deps?: unknown[];
  value: unknown;
}

interface RefSlot {
  kind: "ref";
  value: { current: unknown };
}

type Slot = StateSlot | EffectSlot | MemoSlot | RefSlot;

let slots: Slot[] = [];
let cursor = 0;
let rendering = false;
let revision = 0;
let rootComponent: Component<any> | null = null;
let appId = "mp_unknown";
let scheduled = false;
let disposed = false;
let lastTree: SerializedTree | null = null;
let pendingEffects: Array<() => void> = [];
const handlers = new Map<string, (payload?: unknown) => void>();
const lifecycleHandlers = new Set<
  (event: string, payload?: unknown) => void
>();

function sameDeps(a?: unknown[], b?: unknown[]): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    if (!Object.is(a[index], b[index])) return false;
  }
  return true;
}

export function useState<T>(
  initial: T | (() => T),
): [T, (next: T | ((previous: T) => T)) => void] {
  const index = cursor++;
  let slot = slots[index];
  if (!slot || slot.kind !== "state") {
    const value =
      typeof initial === "function" ? (initial as () => T)() : initial;
    const stateSlot: StateSlot = {
      kind: "state",
      value,
      setter: (next: unknown) => {
        stateSlot.value = next;
        scheduleRender();
      },
    };
    slots[index] = stateSlot;
    slot = stateSlot;
  }
  const state = slot as StateSlot;
  const setter = (next: T | ((previous: T) => T)) => {
    const value =
      typeof next === "function"
        ? (next as (previous: T) => T)(state.value as T)
        : next;
    state.setter(value);
  };
  return [state.value as T, setter];
}

export function useReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initial: S,
): [S, (action: A) => void] {
  const [state, setState] = useState<S>(initial);
  const dispatch = (action: A) => {
    setState((previous) => reducer(previous, action));
  };
  return [state, dispatch];
}

export function useRef<T>(initial: T): { current: T } {
  const index = cursor++;
  let slot = slots[index];
  if (!slot || slot.kind !== "ref") {
    const refSlot: RefSlot = { kind: "ref", value: { current: initial } };
    slots[index] = refSlot;
    slot = refSlot;
  }
  return (slot as RefSlot).value as { current: T };
}

export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  const index = cursor++;
  let slot = slots[index];
  if (!slot || slot.kind !== "memo") {
    const memoSlot: MemoSlot = { kind: "memo", deps, value: factory() };
    slots[index] = memoSlot;
    return memoSlot.value as T;
  }
  const memo = slot as MemoSlot;
  if (!sameDeps(memo.deps, deps)) {
    memo.value = factory();
    memo.deps = deps;
  }
  return memo.value as T;
}

export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: unknown[],
): T {
  return useMemo(() => callback, deps);
}

export function useEffect(
  effect: () => void | (() => void),
  deps?: unknown[],
): void {
  const index = cursor++;
  let slot = slots[index];
  if (!slot || slot.kind !== "effect") {
    const effectSlot: EffectSlot = { kind: "effect", deps, run: true };
    slots[index] = effectSlot;
    slot = effectSlot;
  }
  const current = slot as EffectSlot;
  if (current.run || !sameDeps(current.deps, deps)) {
    current.deps = deps;
    current.run = false;
    pendingEffects.push(() => {
      if (typeof current.cleanup === "function") current.cleanup();
      current.cleanup = effect();
    });
  }
}

/** Attach a lifecycle listener for `resume`, `pause` or `destroy`. */
export function useLifecycle(
  listener: (event: string, payload?: unknown) => void,
): void {
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => {
    const handler = (event: string, payload?: unknown) => ref.current(event, payload);
    lifecycleHandlers.add(handler);
    return () => {
      lifecycleHandlers.delete(handler);
    };
  }, []);
}

function resetCursor(): void {
  cursor = 0;
}

/* -------------------------------------------------------------------------- */
/* Serialization                                                              */
/* -------------------------------------------------------------------------- */

function normalizeChild(child: VNodeChild): VNode[] {
  if (child == null || typeof child === "boolean") return [];
  if (Array.isArray(child)) {
    const out: VNode[] = [];
    for (const item of child) out.push(...normalizeChild(item));
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
  if (!isVNode(child)) return [];
  if (child.type === Fragment) {
    const fragmentChildren = child.props.children;
    return normalizeChild(fragmentChildren as VNodeChild);
  }
  if (typeof child.type === "function") {
    const rendered = (child.type as Component<any>)(child.props);
    return normalizeChild(rendered);
  }
  const children = normalizeChild(
    (child.props.children as VNodeChild) ?? child.children,
  );
  return [
    {
      ...child,
      props: { ...child.props, children },
      children,
    },
  ];
}

function eventNameFor(prop: string): EventName | null {
  if (!prop.startsWith("on") || prop.length < 3) return null;
  const raw = prop.slice(2);
  if (raw === "Press") return "press";
  if (raw === "LongPress") return "longPress";
  if (raw === "Change") return "change";
  if (raw === "CheckedChange") return "change";
  if (raw === "Input") return "input";
  if (raw === "Submit") return "submit";
  if (raw === "ValueChange") return "valueChange";
  if (raw === "Scroll") return "scroll";
  if (raw === "Refresh") return "refresh";
  if (raw === "Focus") return "focus";
  if (raw === "Blur") return "blur";
  if (raw === "Select") return "select";
  return null;
}

function serialize(
  vnode: VNode,
  path: string,
  parent: RenderNode | null,
): RenderNode | null {
  const id = path;
  if (vnode.type === "#text") {
    return { id, type: "#text", props: { text: String(vnode.props.text ?? "") } };
  }
  if (vnode.type === "#fragment" as unknown) return null;
  const props: Record<string, unknown> = {};
  const events: EventName[] = [];
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key === "children" || key === "key") continue;
    if (typeof value === "function") {
      const event = eventNameFor(key);
      if (event) {
        events.push(event);
        handlers.set(`${id}:${event}`, value as (payload?: unknown) => void);
      }
      continue;
    }
    if (value === undefined) continue;
    props[key] = value;
  }
  const children: RenderNode[] = [];
  const rawChildren = normalizeChild(
    (vnode.props.children as VNodeChild) ?? vnode.children,
  );
  rawChildren.forEach((child, index) => {
    const serialized = serialize(child, `${id}.${index}`, null);
    if (serialized) children.push(serialized);
  });
  if (events.length) props.__events = events;
  const node: RenderNode = { id, type: vnode.type as string, props };
  if (events.length) node.events = events;
  if (children.length) node.children = children;
  return node;
}

function renderNow(): void {
  if (disposed || !rootComponent) return;
  if (rendering) {
    scheduled = true;
    return;
  }
  rendering = true;
  try {
    resetCursor();
    handlers.clear();
    pendingEffects = [];
    const vnode = normalizeChild(
      (rootComponent as Component<any>)({ children: [] }),
    )[0];
    const root = vnode ? serialize(vnode, "n0", null) : null;
    revision += 1;
    const tree: SerializedTree = {
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
      } catch (error) {
        reportError(error);
      }
    }
  } catch (error) {
    reportError(error);
  } finally {
    rendering = false;
    if (scheduled) {
      scheduled = false;
      renderNow();
    }
  }
}

export function scheduleRender(): void {
  if (disposed) return;
  if (rendering) {
    scheduled = true;
    return;
  }
  renderNow();
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : "";
  host().send("log", { level: "error", message, stack });
}

/** Start the mini app and emit the first render frame. */
export function start(
  component: Component<any>,
  options: { appId?: string } = {},
): void {
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

export function dispose(): void {
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
export function getRenderTree(): SerializedTree | null {
  return lastTree;
}

export function dispatchEvent(
  id: string,
  event: string,
  payload?: unknown,
): void {
  const handler = handlers.get(`${id}:${event}`);
  if (!handler) return;
  try {
    handler(payload);
  } catch (error) {
    reportError(error);
  }
}

function installGlobals(): void {
  globalThis.__qchatDispatch = (id, event, payload) => {
    dispatchEvent(id, event, payload);
  };
  globalThis.__qchatLifecycle = (event, payload) => {
    for (const listener of lifecycleHandlers) {
      try {
        listener(event, payload);
      } catch (error) {
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

export function assertKnownType(type: string): void {
  if (type === "#text" || hostNodeTypes.has(type)) return;
  throw new QChatError("UNSUPPORTED_COMPONENT", `Unsupported component ${type}`);
}
