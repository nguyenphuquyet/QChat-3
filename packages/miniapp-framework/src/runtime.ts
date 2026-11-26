import { emit, host } from "./host.js";
import {
  FRAGMENT_TYPE,
  HOST_NODE_TYPES,
  PROP_EVENT_MAP,
  TEXT_NODE_TYPE,
} from "./ui-contract.generated.js";
import {
  type BaseProps,
  type EventName,
  type RenderNode,
  type SerializedTree,
  PROTOCOL_VERSION,
  QChatError,
  SDK_VERSION,
} from "./protocol.js";

/* -------------------------------------------------------------------------- */
/* Elements                                                                   */
/* -------------------------------------------------------------------------- */

export type Component<P extends BaseProps = BaseProps> = (
  props: P,
) => VNodeChild;

/** A ref never reaches the host; it exists so `ref` type-checks everywhere. */
export type QappRef<T = unknown> =
  | { current: T | null }
  | ((value: T | null) => void);

export type VNodeChild =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | VNodeChild[];

export interface VNode {
  type: string | Component<any> | ContextProvider;
  props: Record<string, unknown>;
  children: VNodeChild[];
  key?: string;
}

export const Fragment = FRAGMENT_TYPE;

function isVNode(value: unknown): value is VNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value
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
  // `key` and `ref` are element attributes, not host props.
  delete next.key;
  delete next.ref;
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
/* Instances and hooks                                                        */
/* -------------------------------------------------------------------------- */

interface StateSlot {
  kind: "state";
  value: unknown;
  setter: (next: unknown) => void;
}

interface EffectSlot {
  kind: "effect";
  deps?: unknown[];
  cleanup?: void | (() => void);
  /** Layout effects run before the frame is sent, passive effects after. */
  layout: boolean;
  ran: boolean;
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

interface IdSlot {
  kind: "id";
  value: string;
}

type Slot = StateSlot | EffectSlot | MemoSlot | RefSlot | IdSlot;

/**
 * One record per component instance. Hooks live here instead of in a single
 * global slot list, so a child component owns its own state, effects and refs.
 * The instance key is built from the position in the element tree plus the
 * element `key`, so reordering a keyed list keeps every child's state.
 */
interface Instance {
  key: string;
  component: Component<any>;
  slots: Slot[];
}

let instances = new Map<string, Instance>();
let rootComponent: Component<any> | null = null;
let appId = "mp_unknown";
let currentInstance: Instance | null = null;
let cursor = 0;
let visited = new Set<string>();
let revision = 0;
/**
 * Trail of the components being rendered, from the root down to the component
 * that owns the node currently being built.
 *
 * Node ids are positional (`n0.1.0`), so two screens can use the same id for
 * two different widgets. This trail is what tells them apart: it is the same
 * every time a screen renders and different for every other screen, so the host
 * can keep per-screen widget state (the offset of a `ScrollView`) while still
 * restoring it when the user comes back to that screen.
 */
let componentChain = "";
const componentIds = new WeakMap<Component<any>, number>();
let nextComponentId = 1;

function componentId(component: Component<any>): number {
  const known = componentIds.get(component);
  if (known != null) return known;
  const assigned = nextComponentId;
  nextComponentId += 1;
  componentIds.set(component, assigned);
  return assigned;
}
let lastTree: SerializedTree | null = null;
let rendering = false;
let batching = 0;
let dirty = false;
let disposed = false;
let pendingLayout: Array<() => void> = [];
let pendingPassive: Array<() => void> = [];
let pendingCleanups: Array<() => void> = [];
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

function activeInstance(): Instance {
  if (!currentInstance) {
    throw new QChatError(
      "HOOK_OUTSIDE_COMPONENT",
      "Hooks can only be called inside a component",
    );
  }
  return currentInstance;
}

function nextSlot<T extends Slot>(
  kind: T["kind"],
  create: () => T,
): T {
  const instance = activeInstance();
  const index = cursor++;
  const existing = instance.slots[index];
  if (existing && existing.kind === kind) return existing as T;
  if (existing && existing.kind === "effect" && typeof existing.cleanup === "function") {
    const cleanup = existing.cleanup;
    pendingCleanups.push(() => cleanup());
  }
  const created = create();
  instance.slots[index] = created;
  return created;
}

export function useState<T>(
  initial: T | (() => T),
): [T, (next: T | ((previous: T) => T)) => void] {
  const slot = nextSlot<StateSlot>("state", () => {
    const created: StateSlot = {
      kind: "state",
      value: typeof initial === "function" ? (initial as () => T)() : initial,
      setter: (next: unknown) => {
        const value =
          typeof next === "function"
            ? (next as (previous: unknown) => unknown)(created.value)
            : next;
        if (Object.is(created.value, value)) return;
        created.value = value;
        scheduleRender();
      },
    };
    return created;
  });
  // The setter identity stays stable across renders, like React.
  return [slot.value as T, slot.setter as (next: T | ((previous: T) => T)) => void];
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
  const slot = nextSlot<RefSlot>("ref", () => ({
    kind: "ref",
    value: { current: initial },
  }));
  return slot.value as { current: T };
}

export function useMemo<T>(factory: () => T, deps?: unknown[]): T {
  const slot = nextSlot<MemoSlot>("memo", () => ({
    kind: "memo",
    deps,
    value: factory(),
  }));
  if (!sameDeps(slot.deps, deps)) {
    slot.value = factory();
    slot.deps = deps;
  }
  return slot.value as T;
}

export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps?: unknown[],
): T {
  return useMemo(() => callback, deps);
}

function useEffectImpl(
  effect: () => void | (() => void),
  deps: unknown[] | undefined,
  layout: boolean,
): void {
  const slot = nextSlot<EffectSlot>("effect", () => ({
    kind: "effect",
    deps,
    layout,
    ran: false,
  }));
  const shouldRun =
    !slot.ran || deps === undefined || !sameDeps(slot.deps, deps);
  if (!shouldRun) return;
  slot.ran = true;
  slot.deps = deps;
  slot.layout = layout;
  const task = () => {
    if (typeof slot.cleanup === "function") slot.cleanup();
    slot.cleanup = effect();
  };
  if (layout) pendingLayout.push(task);
  else pendingPassive.push(task);
}

export function useEffect(
  effect: () => void | (() => void),
  deps?: unknown[],
): void {
  useEffectImpl(effect, deps, false);
}

/** Same as `useEffect` but runs before the frame is handed to Flutter. */
export function useLayoutEffect(
  effect: () => void | (() => void),
  deps?: unknown[],
): void {
  useEffectImpl(effect, deps, true);
}

/** A stable id, unique per component instance and hook position. */
export function useId(): string {
  const slot = nextSlot<IdSlot>("id", () => {
    const instance = activeInstance();
    const index = cursor - 1;
    return { kind: "id", value: `qapp_${sanitizeId(instance.key)}_${index}` };
  });
  return slot.value;
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 64);
}

/** Attach a lifecycle listener for `resume`, `pause` or `destroy`. */
export function useLifecycle(
  listener: (event: string, payload?: unknown) => void,
): void {
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => {
    const handler = (event: string, payload?: unknown) =>
      ref.current(event, payload);
    lifecycleHandlers.add(handler);
    return () => {
      lifecycleHandlers.delete(handler);
    };
  }, []);
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

export interface ContextProvider {
  (props: { value: unknown; children?: VNodeChild }): VNodeChild;
}

export interface Context<T> {
  readonly defaultValue: T;
  readonly Provider: ContextProvider;
  readonly Consumer: (props: {
    children: (value: T) => VNodeChild;
  }) => VNodeChild;
  /** The value visible to `useContext`; the nearest provider replaces it. */
  value: T;
}

export function createContext<T>(defaultValue: T): Context<T> {
  const context = { defaultValue, value: defaultValue } as Context<T>;
  const Provider: ContextProvider = (props) => props.children;
  (Provider as unknown as { __qchatContext?: Context<T> }).__qchatContext =
    context;
  const Consumer = (props: { children: (value: T) => VNodeChild }) =>
    props.children(context.value);
  return Object.assign(context, { Provider, Consumer });
}

export function useContext<T>(context: Context<T>): T {
  return context.value;
}

function providerFor(type: unknown): Context<any> | null {
  if (typeof type !== "function") return null;
  const context = (type as { __qchatContext?: Context<any> }).__qchatContext;
  return context ?? null;
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

interface HostNode {
  type: string;
  props: Record<string, unknown>;
  events: Array<{ name: EventName; handler: (payload?: unknown) => void }>;
  children: HostNode[];
  /** Component trail at the moment the node was created; see `componentChain`. */
  owner?: string;
}

function slotName(element: VNode, index: number): string {
  return element.key != null ? `#${element.key}` : `@${index}`;
}

function flatten(value: VNodeChild, out: unknown[]): void {
  if (value == null || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out);
    return;
  }
  out.push(value);
}

/** Map a JSX event prop (for example `onPress`) to its wire event name. */
function eventNameFor(prop: string): EventName | null {
  // Only props declared in the contract become events, so an unknown handler is
  // dropped instead of leaking a function into the render frame.
  const event = PROP_EVENT_MAP[prop];
  return event ? (event as EventName) : null;
}

function renderChildren(value: VNodeChild, ownerKey: string): HostNode[] {
  const items: unknown[] = [];
  flatten(value, items);
  const nodes: HostNode[] = [];
  let index = 0;
  for (const item of items) {
    if (typeof item === "string" || typeof item === "number") {
      nodes.push({
        type: TEXT_NODE_TYPE,
        props: { text: String(item) },
        events: [],
        children: [],
        owner: componentChain,
      });
      index++;
      continue;
    }
    const element = item as VNode;
    if (!isVNode(element)) {
      index++;
      continue;
    }
    nodes.push(...renderElement(element, ownerKey, slotName(element, index)));
    index++;
  }
  return nodes;
}

function renderElement(
  element: VNode,
  ownerKey: string,
  slot: string,
): HostNode[] {
  const type = element.type;
  if (type === Fragment) {
    return renderChildren(element.props.children as VNodeChild, `${ownerKey}/${slot}~`);
  }
  const context = providerFor(type);
  if (context) {
    const provided = element.props.value as unknown;
    const previous = context.value;
    context.value = provided === undefined ? context.defaultValue : provided;
    try {
      return renderChildren(
        element.props.children as VNodeChild,
        `${ownerKey}/${slot}c`,
      );
    } finally {
      context.value = previous;
    }
  }
  if (typeof type === "function") {
    return renderComponent(type as Component<any>, element.props, ownerKey, slot);
  }
  if (typeof type !== "string") return [];
  assertKnownType(type);
  const node: HostNode = {
    type,
    props: {},
    events: [],
    children: [],
    owner: componentChain,
  };
  // Several props can map to one event (`onChange` and `onCheckedChange` both
  // fire `change`), so the wire event list never repeats a name.
  const byEvent = new Map<EventName, (payload?: unknown) => void>();
  for (const [prop, value] of Object.entries(element.props)) {
    if (prop === "children" || prop === "key" || prop === "ref") continue;
    if (typeof value === "function") {
      const event = eventNameFor(prop);
      if (event) byEvent.set(event, value as (payload?: unknown) => void);
      continue;
    }
    if (value === undefined) continue;
    node.props[prop] = value;
  }
  node.events = [...byEvent].map(([name, handler]) => ({ name, handler }));
  node.children = renderChildren(
    element.props.children as VNodeChild,
    `${ownerKey}/${slot}#`,
  );
  return [node];
}

function renderComponent(
  component: Component<any>,
  props: Record<string, unknown>,
  ownerKey: string,
  slot: string,
): HostNode[] {
  const key = `${ownerKey}/${slot}`;
  let instance = instances.get(key);
  if (!instance || instance.component !== component) {
    instance = { key, component, slots: [] };
    instances.set(key, instance);
  }
  visited.add(key);
  const previousInstance = currentInstance;
  const previousCursor = cursor;
  const previousChain = componentChain;
  currentInstance = instance;
  cursor = 0;
  componentChain = previousChain
    ? `${previousChain}.${componentId(component)}`
    : String(componentId(component));
  let output: VNodeChild = null;
  try {
    output = component(props);
  } catch (error) {
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
  // The chain stays pushed while the component's own output is turned into
  // host nodes, so every node they contain records the screen it belongs to.
  try {
    return renderChildren(output, key);
  } finally {
    componentChain = previousChain;
  }
}

function serialize(node: HostNode, id: string): RenderNode {
  const props: Record<string, unknown> = { ...node.props };
  const children = node.children.map((child, index) =>
    serialize(child, `${id}.${index}`),
  );
  const events: EventName[] = [];
  for (const entry of node.events) {
    events.push(entry.name);
    handlers.set(`${id}:${entry.name}`, entry.handler);
  }
  if (events.length) props.__events = events;
  const result: RenderNode = { id, type: node.type, props };
  if (events.length) result.events = events;
  if (children.length) result.children = children;
  return result;
}

function safe(task: () => void): void {
  try {
    task();
  } catch (error) {
    reportError(error);
  }
}

function renderNow(): void {
  if (disposed || !rootComponent) return;
  if (rendering) {
    dirty = true;
    return;
  }
  rendering = true;
  try {
    visited = new Set<string>();
    handlers.clear();
    pendingLayout = [];
    pendingPassive = [];
    pendingCleanups = [];
    const hostRoots = renderComponent(
      rootComponent,
      { children: [] },
      "",
      "root",
    );
    // The screen is the component trail that produced the frame's root node, so
    // a tab or a route keeps its own widget state while ids stay positional
    // inside it. An app whose screens share one wrapper component still frames
    // every screen as the same trail and behaves as before.
    const screen = hostRoots[0]?.owner ?? "";
    const root: RenderNode | null =
      hostRoots.length === 0
        ? null
        : hostRoots.length === 1
          ? serialize(hostRoots[0], "n0")
          : serialize(
              { type: "View", props: {}, events: [], children: hostRoots },
              "n0",
            );
    revision += 1;
    const tree: SerializedTree = {
      v: PROTOCOL_VERSION,
      appId,
      screen,
      root,
      revision,
    };
    lastTree = tree;
    // Unmount instances that were not touched by this pass.
    for (const [key, instance] of instances) {
      if (visited.has(key)) continue;
      for (const slot of instance.slots) {
        if (slot.kind === "effect" && typeof slot.cleanup === "function") {
          const cleanup = slot.cleanup;
          pendingCleanups.push(() => cleanup());
        }
      }
      instances.delete(key);
    }
    for (const cleanup of pendingCleanups) safe(cleanup);
    for (const task of pendingLayout) safe(task);
    host().send("render", tree);
  } catch (error) {
    reportError(error);
  } finally {
    rendering = false;
  }
  batching++;
  try {
    for (const task of pendingPassive) safe(task);
  } finally {
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

export function scheduleRender(): void {
  if (disposed) return;
  if (rendering || batching > 0) {
    dirty = true;
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

export function dispose(): void {
  disposed = true;
  for (const instance of instances.values()) {
    for (const slot of instance.slots) {
      if (slot.kind === "effect" && typeof slot.cleanup === "function") {
        try {
          slot.cleanup();
        } catch (error) {
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
  batching++;
  try {
    handler(payload);
  } catch (error) {
    reportError(error);
  } finally {
    batching--;
  }
  // Every setState from this one event collapses into a single frame.
  if (dirty) {
    dirty = false;
    renderNow();
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

/** Node types the host understands, generated from the UI contract. */
export const hostNodeTypes: ReadonlySet<string> = HOST_NODE_TYPES;

export function assertKnownType(type: string): void {
  if (type === TEXT_NODE_TYPE || hostNodeTypes.has(type)) return;
  throw new QChatError("UNSUPPORTED_COMPONENT", `Unsupported component ${type}`);
}
